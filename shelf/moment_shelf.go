package shelf

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"strconv"

	"time"

	log "github.com/Sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

type momentShelf struct {
	path    string
	moments map[string]*Moment
}

func newMomentShelf(path string) *momentShelf {
	return &momentShelf{
		path:    path,
		moments: make(map[string]*Moment),
	}

}
func (s *momentShelf) Size() int {
	return len(s.moments)
}

func (s *momentShelf) AsSlice() []*Moment {
	i := 0
	lst := make([]*Moment, len(s.moments))
	for _, m := range s.moments {
		lst[i] = m
		i++
	}
	return lst
}

func (s *momentShelf) Lookup(path string) *Moment {
	return s.moments[path]
}

func (s *momentShelf) dirOf(t time.Time) string {
	return filepath.Join(s.path, strconv.Itoa(t.Year()))
}

func (s *momentShelf) pathOf(t time.Time) string {
	return filepath.Join(s.dirOf(t), t.Format("01-02_15:04:05")+".yml")
}

func (s *momentShelf) keyOf(t time.Time) string {
	return t.Format("/2006/01/02/15:04:05/")
}

func (s *momentShelf) Save(origTime time.Time, m *Moment) error {
	data, err := yaml.Marshal(m)
	if err != nil {
		return err
	}
	path := s.pathOf(m.Date)
	err = ioutil.WriteFile(path, data, 0644)
	if err != nil {
		return err
	}
	s.moments[s.keyOf(m.Date)] = m
	if !origTime.IsZero() {
		orig := s.pathOf(origTime)
		if orig != path {
			err = os.Remove(orig)
			if err != nil {
				return err
			}
			delete(s.moments, s.keyOf(origTime))
		}
	}
	return nil
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

func (s *momentShelf) Init() error {
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
			log.Debugf("Moment %s -> %s", m.Path(), m.Title)
		}
		return nil
	})
	return err
}
