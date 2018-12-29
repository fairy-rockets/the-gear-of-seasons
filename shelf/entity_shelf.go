package shelf

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	log "github.com/Sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

type entityShelf struct {
	path     string
	entities map[string]Entity
}

func newEntityShelf(path string) *entityShelf {
	return &entityShelf{
		path:     path,
		entities: make(map[string]Entity),
	}
}

func (s *entityShelf) Path() string {
	return s.path
}

func (s *entityShelf) Size() int {
	return len(s.entities)
}

func loadMetadata(path string, out interface{}) (Entity, error) {
	f, err := os.Open(path)
	if err != nil {
		log.Fatalf("Failed to open %s: %v", path, err)
	}
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	if err != nil {
		return nil, err
	}
	err = yaml.Unmarshal(data, out)
	if err != nil {
		return nil, err
	}
	return out.(Entity), nil
}

func (s *entityShelf) Init() error {
	err := filepath.Walk(s.path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		var e Entity
		dirName, fileName := filepath.Split(path)
		if strings.HasSuffix(fileName, ".image.yml") {
			ent := &ImageEntity{}
			ent.ID_ = strings.TrimSuffix(fileName, ".image.yml")
			e, err = loadMetadata(path, ent)
			switch ent.MimeType_ {
			case "image/gif":
				ent.Path_ = filepath.Join(dirName, ent.ID_) + ".gif"
			case "image/jpeg":
				ent.Path_ = filepath.Join(dirName, ent.ID_) + ".jpg"
			case "image/png":
				ent.Path_ = filepath.Join(dirName, ent.ID_) + ".png"
			default:
				log.Fatalf("Unknwon image type: %s", ent.MimeType_)
			}
		} else if strings.HasSuffix(fileName, ".video.yml") {
			ent := &VideoEntity{}
			ent.ID_ = strings.TrimSuffix(fileName, ".video.yml")
			e, err = loadMetadata(path, ent)
			switch ent.MimeType_ {
			case "video/mp4":
				ent.Path_ = filepath.Join(dirName, ent.ID_) + ".mp4"
			default:
				log.Fatalf("Unknwon video type: %s", ent.MimeType_)
			}
		} else if strings.HasSuffix(fileName, ".audio.yml") {
			ent := &AudioEntity{}
			ent.ID_ = strings.TrimSuffix(fileName, ".audio.yml")
			e, err = loadMetadata(path, ent)
			switch ent.MimeType_ {
			default:
				log.Fatalf("Unknwon audio type: %s", ent.MimeType_)
			}
		} else {
			//Continue...
			return nil
		}
		if err != nil {
			return err
		}
		_, err = os.Stat(e.Path())
		if err != nil {
			return fmt.Errorf("file not found: %s", e.Path())
		}
		if filepath.Dir(e.Path()) != s.dirOf(e) {
			log.Warnf("Dir mismatched: %s != %s", filepath.Dir(e.Path()), s.dirOf(e))
			// TODO: move?
		}
		s.entities[e.ID()] = e
		log.Debugf("Entity: %s (%s)", e.ID(), e.MimeType())
		return nil
	})
	return err
}

func (s *entityShelf) dirOf(e Entity) string {
	return filepath.Join(s.path, strconv.Itoa(e.Date().Year()))
}

func (s *entityShelf) Lookup(id string) Entity {
	return s.entities[id]
}

func (s *entityShelf) AsSlice() []Entity {
	i := 0
	lst := make([]Entity, len(s.entities))
	for _, e := range s.entities {
		lst[i] = e
		i++
	}
	return lst
}
