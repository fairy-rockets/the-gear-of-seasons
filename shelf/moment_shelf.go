package shelf

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	log "github.com/Sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

type MomentShelf struct {
	path    string
	moments map[string]*Moment
}

func newMomentShelf(path string) *MomentShelf {
	return &MomentShelf{
		path:    path,
		moments: make(map[string]*Moment),
	}

}
func (s *MomentShelf) Size() int {
	return len(s.moments)
}

func (s *MomentShelf) AsSlice() []*Moment {
	i := 0
	lst := make([]*Moment, len(s.moments))
	for _, m := range s.moments {
		lst[i] = m
		i++
	}
	return lst
}

func (s *MomentShelf) Lookup(path string) *Moment {
	return s.moments[path]
}

func loadMomentFromFile(path string, out *Moment) error {
	f, err := os.Open(path)
	if err != nil {
		log.Fatalf("Failed to open %s: %v", path, err)
	}
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	if err != nil {
		return err
	}
	return yaml.Unmarshal(data, out)
}

func (s *MomentShelf) Init() error {
	err := filepath.Walk(s.path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if strings.HasSuffix(path, ".yml") {
			m := &Moment{}
			err = loadMomentFromFile(path, m)
			if err != nil {
				return err
			}
			s.moments[m.Path()] = m
			log.Infof("Moment %s -> %s", m.Path(), m.Title)
		}
		return nil
	})
	return err
}