package shelf

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"image"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	log "github.com/Sirupsen/logrus"
	"github.com/fairy-rockets/the-gear-of-seasons/util"
	"gopkg.in/yaml.v2"
)

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
