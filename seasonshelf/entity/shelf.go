package entity

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	log "github.com/Sirupsen/logrus"

	"fmt"

	"gopkg.in/yaml.v2"
)

type Shelf struct {
	path     string
	entities map[string]Entity
}

func NewShelf(path string) *Shelf {
	return &Shelf{
		path:     path,
		entities: make(map[string]Entity),
	}
}

func (s *Shelf) Path() string {
	return s.path
}

func (s *Shelf) Size() int {
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

func (s *Shelf) Init() error {
	err := filepath.Walk(s.path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		var e Entity
		base := filepath.Dir(path)
		if strings.HasSuffix(path, ".image.yml") {
			ent := &ImageEntity{}
			e, err = loadMetadata(path, ent)
			switch ent.MimeType {
			case "image/gif":
				ent.Path = filepath.Join(base, ent.ID) + ".gif"
			case "image/jpeg":
				ent.Path = filepath.Join(base, ent.ID) + ".jpg"
			case "image/png":
				ent.Path = filepath.Join(base, ent.ID) + ".png"
			default:
				log.Fatalf("Unknwon image type: %s", ent.MimeType)
			}
		} else if strings.HasSuffix(path, ".video.yml") {
			ent := &VideoEntity{}
			e, err = loadMetadata(path, ent)
			switch ent.MimeType {
			case "video/mp4":
				ent.Path = filepath.Join(base, ent.ID) + ".mp4"
			default:
				log.Fatalf("Unknwon video type: %s", ent.MimeType)
			}
		} else if strings.HasSuffix(path, ".audio.yml") {
			ent := &AudioEntity{}
			e, err = loadMetadata(path, ent)
			switch ent.MimeType {
			default:
				log.Fatalf("Unknwon audio type: %s", ent.MimeType)
			}
		} else {
			//Continue...
			return nil
		}
		if err != nil {
			return err
		}
		_, err = os.Stat(e.GetPath())
		if err != nil {
			return fmt.Errorf("file not found: %s", e.GetPath())
		}
		s.entities[e.GetID()] = e
		log.Infof("Entity: %s (%s)", e.GetID(), e.GetMimeType())
		return nil
	})
	return err
}

func (s *Shelf) Lookup(id string) Entity {
	return s.entities[id]
}

func (s *Shelf) AsSlice() []Entity {
	i := 0
	lst := make([]Entity, len(s.entities))
	for _, e := range s.entities {
		lst[i] = e
		i++
	}
	return lst
}
