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
		log.Infof("Entity: %s (%s)", e.ID(), e.MimeType())
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

func (s *entityShelf) AddImage(mimeType string, buffer []byte) (*ImageEntity, error) {
	var err error
	img, format, err := image.Decode(bytes.NewReader(buffer))
	if err != nil {
		return nil, err
	}

	e := &ImageEntity{}
	ext := ""

	switch format {
	case "jpeg":
		e.MimeType_ = "image/jpeg"
		ext = "jpg"
	case "png":
		e.MimeType_ = "image/png"
		ext = "png"
	case "gif":
		e.MimeType_ = "image/gif"
		ext = "gif"
	default:
		return nil, fmt.Errorf("unknown image format: %s", format)
	}
	e.Date_ = time.Now()
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
				e.Date_ = date
			}
		}
	}
	hash := md5.Sum(buffer)
	e.ID_ = hex.EncodeToString(hash[:])
	e.Width = img.Bounds().Size().X
	e.Height = img.Bounds().Size().Y
	e.Description_ = ""

	// Save image.
	dirpath := s.dirOf(e)
	yml, err := yaml.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize yaml: %v", err)
	}
	ymlpath := filepath.Join(dirpath, fmt.Sprintf("%s.image.yml", e.ID_))
	path := filepath.Join(dirpath, fmt.Sprintf("%s.%s", e.ID_, ext))
	e.Path_ = path
	err = ioutil.WriteFile(path, buffer, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to save image: %v", err)
	}
	err = ioutil.WriteFile(ymlpath, yml, 0644)
	if err != nil {
		os.Remove(path)
		return nil, fmt.Errorf("failed to save image metadata: %v", err)
	}
	s.entities[e.ID_] = e
	return e, nil
}
