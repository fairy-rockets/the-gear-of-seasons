package shelf

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"time"

	log "github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

const momentPath = "moment"

type momentShelf struct {
	storage *Storage
	moments map[string]*Moment
}

func newMomentShelf(storage *Storage) *momentShelf {
	return &momentShelf{
		storage: storage,
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

func (s *momentShelf) Lookup(url string) *Moment {
	return s.moments[url]
}

func (s *momentShelf) calcURL(t time.Time) string {
	return t.Format("/2006/01/02/15:04:05/")
}

func (s *momentShelf) calcFilePath(t time.Time) (string, string) {
	return filepath.Join(momentPath, strconv.Itoa(t.Year())), t.Format("01-02_15:04:05") + ".yml"
}

func (s *momentShelf) Save(origTime time.Time, m *Moment) error {
	yamlData, err := yaml.Marshal(m)
	if err != nil {
		return err
	}
	newDir, newName := s.calcFilePath(m.Date)
	err = s.storage.Mkdir(newDir)
	if err != nil {
		return err
	}
	err = s.storage.WriteFile(filepath.Join(newDir, newName), yamlData)
	if err != nil {
		return err
	}
	s.moments[s.calcURL(m.Date)] = m
	if !origTime.IsZero() {
		oldDir, oldName := s.calcFilePath(origTime)
		if !(oldDir == newDir && oldName == newName) {
			err = s.storage.Remove(filepath.Join(oldDir, oldName))
			if err != nil {
				return err
			}
			delete(s.moments, s.calcURL(origTime))
		}
	}
	return nil
}

func loadMomentFromFile(s *Storage, path string, out *Moment) error {
	data, err := s.ReadFile(path)
	if err != nil {
		log.Fatalf("Failed to open %s: %v", path, err)
	}
	return yaml.Unmarshal(data, out)
}

func (s *momentShelf) Init() error {
	return s.storage.WalkFiles(momentPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if strings.HasSuffix(path, ".yml") {
			m := &Moment{}
			err = loadMomentFromFile(s.storage, path, m)
			if err != nil {
				return err
			}
			s.moments[m.Path()] = m
			log.Debugf("Moment %s -> %s", m.Path(), m.Title)
		}
		return nil
	})
}
