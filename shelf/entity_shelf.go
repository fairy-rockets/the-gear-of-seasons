package shelf

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/fairy-rockets/the-gear-of-seasons/storage"

	log "github.com/Sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

const EntityPath = "entity"

type entityShelf struct {
	storage  *storage.Storage
	entities map[string]Entity
}

func newEntityShelf(storage *storage.Storage) *entityShelf {
	return &entityShelf{
		storage:  storage,
		entities: make(map[string]Entity),
	}
}

func (s *entityShelf) Size() int {
	return len(s.entities)
}

func loadMetadata(storage *storage.Storage, path string, out Entity) (Entity, error) {
	f, err := storage.OpenFile(path)
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
	return out, nil
}

func (s *entityShelf) Init() error {
	return s.storage.WalkFiles(EntityPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		var e Entity
		dirName, fileName := filepath.Split(path)
		if strings.HasSuffix(fileName, ".image.yml") {
			ent := &ImageEntity{}
			ent.ID_ = strings.TrimSuffix(fileName, ".image.yml")
			ent.MetaPath_ = path
			if e, err = loadMetadata(s.storage, path, ent); err != nil {
				return err
			}
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
			ent.MetaPath_ = path
			if e, err = loadMetadata(s.storage, path, ent); err != nil {
				return err
			}
			switch ent.MimeType_ {
			case "video/mp4":
				ent.Path_ = filepath.Join(dirName, ent.ID_) + ".mp4"
			default:
				log.Fatalf("Unknwon video type: %s", ent.MimeType_)
			}
		} else if strings.HasSuffix(fileName, ".audio.yml") {
			ent := &AudioEntity{}
			ent.ID_ = strings.TrimSuffix(fileName, ".audio.yml")
			ent.MetaPath_ = path
			if e, err = loadMetadata(s.storage, path, ent); err != nil {
				return err
			}
			switch ent.MimeType_ {
			default:
				log.Fatalf("Unknwon audio type: %s", ent.MimeType_)
			}
		} else {
			//Continue...
			return nil
		}
		if !s.storage.Exists(e.Path()) {
			return fmt.Errorf("file not found: %s", e.Path())
		}
		expectedDir := s.calcDir(e)
		if filepath.Dir(e.Path()) != expectedDir {
			log.Warnf("Dir mismatched: %s != %s", filepath.Dir(e.Path()), expectedDir)
			// TODO: move?
		}
		s.entities[e.ID()] = e
		log.Debugf("Entity: %s (%s)", e.ID(), e.MimeType())
		return nil
	})
}

func (s *entityShelf) calcDir(e Entity) string {
	return strconv.Itoa(e.Date().Year())
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
