package shelf

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"image"
	"path/filepath"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/fairy-rockets/the-gear-of-seasons/util"
	"gopkg.in/yaml.v2"
)

func (s *entityShelf) AddImage(mimeType string, imageBuffer []byte) (*ImageEntity, error) {
	var err error
	img, format, err := image.Decode(bytes.NewReader(imageBuffer))
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
		x, err := util.DecodeExif(bytes.NewReader(imageBuffer))
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
	hash := md5.Sum(imageBuffer)
	e.ID_ = hex.EncodeToString(hash[:])
	e.Width = img.Bounds().Size().X
	e.Height = img.Bounds().Size().Y
	e.Description_ = ""

	// Save image.
	dir := s.calcDir(e)
	yamlData, err := yaml.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize yaml: %v", err)
	}
	yamlPath := filepath.Join(dir, fmt.Sprintf("%s.image.yml", e.ID_))
	imagePath := filepath.Join(dir, fmt.Sprintf("%s.%s", e.ID_, ext))
	e.Path_ = imagePath
	e.SystemPath_ = s.storage.path(imagePath)
	e.MetaPath_ = yamlPath
	err = s.storage.WriteFile(imagePath, imageBuffer)
	if err != nil {
		return nil, fmt.Errorf("failed to save image: %v", err)
	}
	err = s.storage.WriteFile(yamlPath, yamlData)
	if err != nil {
		return nil, fmt.Errorf("failed to save image metadata: %v", err)
	}
	s.entities[e.ID_] = e
	return e, nil
}

func (s *entityShelf) RemoveImage(e *ImageEntity) error {
	var err error
	err = s.storage.Remove(e.Path())
	if err != nil {
		return err
	}
	err = s.storage.Remove(e.MetaPath())
	if err != nil {
		return err
	}
	return nil
}
