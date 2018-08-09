package shelf

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	log "github.com/Sirupsen/logrus"

	"fmt"

	"crypto/md5"
	"encoding/hex"

	"bytes"
	"image"

	"time"

	"strconv"

	"github.com/fairy-rockets/the-gear-of-seasons/util"
	"gopkg.in/yaml.v2"
)

type EntityShelf struct {
	path     string
	entities map[string]Entity
}

func newEntityShelf(path string) *EntityShelf {
	return &EntityShelf{
		path:     path,
		entities: make(map[string]Entity),
	}
}

func (s *EntityShelf) Path() string {
	return s.path
}

func (s *EntityShelf) Size() int {
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

func (s *EntityShelf) Init() error {
	err := filepath.Walk(s.path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		var e Entity
		dirName := filepath.Dir(path)
		if strings.HasSuffix(path, ".image.yml") {
			ent := &ImageEntity{}
			e, err = loadMetadata(path, ent)
			switch ent.MimeType {
			case "image/gif":
				ent.Path = filepath.Join(dirName, ent.ID) + ".gif"
			case "image/jpeg":
				ent.Path = filepath.Join(dirName, ent.ID) + ".jpg"
			case "image/png":
				ent.Path = filepath.Join(dirName, ent.ID) + ".png"
			default:
				log.Fatalf("Unknwon image type: %s", ent.MimeType)
			}
		} else if strings.HasSuffix(path, ".video.yml") {
			ent := &VideoEntity{}
			e, err = loadMetadata(path, ent)
			switch ent.MimeType {
			case "video/mp4":
				ent.Path = filepath.Join(dirName, ent.ID) + ".mp4"
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
		if filepath.Dir(e.GetPath()) != s.dirOf(e) {
			log.Warnf("Dir mismatched: %s != %s", filepath.Dir(e.GetPath()), s.dirOf(e))
			// TODO: move?
		}
		fileName := filepath.Base(path)
		id := fileName[:strings.Index(fileName, ".")]
		if id != e.GetID() {
			log.Warnf("ID mismatched: %s != %s(%s)", id, e.GetID(), e.GetPath())
			// TODO: move?
		}
		s.entities[e.GetID()] = e
		log.Infof("Entity: %s (%s)", e.GetID(), e.GetMimeType())
		return nil
	})
	return err
}

func (s *EntityShelf) dirOf(e Entity) string {
	return filepath.Join(s.path, strconv.Itoa(e.GetDate().Year()))
}

func (s *EntityShelf) Lookup(id string) Entity {
	return s.entities[id]
}

func (s *EntityShelf) AsSlice() []Entity {
	i := 0
	lst := make([]Entity, len(s.entities))
	for _, e := range s.entities {
		lst[i] = e
		i++
	}
	return lst
}

func (s *EntityShelf) AddImage(mimeType string, buffer []byte) (*ImageEntity, error) {
	var err error
	img, format, err := image.Decode(bytes.NewReader(buffer))
	if err != nil {
		return nil, err
	}

	e := &ImageEntity{}
	ext := ""

	switch format {
	case "jpeg":
		e.MimeType = "image/jpeg"
		ext = "jpg"
	case "png":
		e.MimeType = "image/png"
		ext = "png"
	case "gif":
		e.MimeType = "image/gif"
		ext = "gif"
	default:
		return nil, fmt.Errorf("unknown image format: %s", format)
	}
	e.Date = time.Now()
	if format == "jpeg" {
		x, err := util.DecodeExif(bytes.NewReader(buffer))
		if err != nil {
			return nil, err
		}
		if x != nil {
			date, err := x.DateTime()
			if err != nil {
				log.Errorf("Failed to decode exif: %v", err)
			} else {
				e.Date = date
			}
		}
	}
	hash := md5.Sum(buffer)
	e.ID = hex.EncodeToString(hash[:])
	e.Width = img.Bounds().Size().X
	e.Height = img.Bounds().Size().Y
	e.Description = ""

	// Save image.
	dirpath := s.dirOf(e)
	yml,err := yaml.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize yaml: %v", err)
	}
	ymlpath := filepath.Join(dirpath, fmt.Sprintf("%s.image.yml", e.ID))
	path := filepath.Join(dirpath, fmt.Sprintf("%s.%s", e.ID, ext))
	e.Path = path
	err = ioutil.WriteFile(path, buffer, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to save image: %v", err)
	}
	err = ioutil.WriteFile(ymlpath, yml, 0644)
	if err != nil {
		os.Remove(path)
		return nil, fmt.Errorf("failed to save image metadata: %v", err)
	}
	s.entities[e.ID] = e
	return e, nil
}
