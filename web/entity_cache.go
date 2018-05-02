package web

import (
	"image"
	"image/jpeg"
	"os"

	"path/filepath"

	"fmt"

	"strconv"

	"github.com/FairyRockets/the-gear-of-seasons/entity"
	"github.com/disintegration/imaging"
	"github.com/nfnt/resize"
	"github.com/oliamb/cutter"
)

const (
	ThumbnailsSize = 128
)

type entityCache struct {
	entities *entity.Store
	path     string
}

func newEntityCache(entities *entity.Store, path string) *entityCache {
	return &entityCache{
		entities: entities,
		path:     path,
	}
}

func (cache *entityCache) thumbnailsPathOf(img *entity.ImageEntity) string {
	return filepath.Join(cache.path, "thumbnail", strconv.Itoa(img.Date.Year()), img.ID+".jpg")
}

func (cache *entityCache) lookupThumbnail(img *entity.ImageEntity) (string, bool) {
	path := cache.thumbnailsPathOf(img)
	_, err := os.Stat(path)
	return path, err == nil
}

func (cache *entityCache) FetchThumbnail(e entity.Entity) (string, error) {
	ent, ok := e.(*entity.ImageEntity)
	if !ok {
		return "", fmt.Errorf("%s is not an image", e.GetPath())
	}
	if url, ok := cache.lookupThumbnail(ent); ok {
		return url, nil
	}
	f, err := os.Open(e.GetPath())
	if err != nil {
		err = fmt.Errorf("failed to open %s: %v", e.GetPath(), err)
		return "", err
	}
	defer f.Close()
	img, _, err := image.Decode(f)
	if err != nil {
		err = fmt.Errorf("failed to decode %s: %v", e.GetPath(), err)
		return "", err
	}
	if ent.Width > ent.Height {
		img = resize.Resize(uint(ent.Width*ThumbnailsSize/ent.Height), ThumbnailsSize, img, resize.Bicubic)
	} else {
		img = resize.Resize(ThumbnailsSize, uint(ent.Height*ThumbnailsSize/ent.Width), img, resize.Bicubic)
	}
	img, err = cutter.Crop(img, cutter.Config{
		Width:  ThumbnailsSize,
		Height: ThumbnailsSize,
		Mode:   cutter.Centered,
	})
	if err != nil {
		err = fmt.Errorf("failed to cut %s: %v", e.GetPath(), err)
		return "", err
	}
	path := cache.thumbnailsPathOf(ent)
	if err = os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		err = fmt.Errorf("failed to prepare dir for %s: %v", path, err)
		return "", err
	}
	tf, err := os.Create(path)
	if err != nil {
		err = fmt.Errorf("failed to create %s: %v", path, err)
		return "", err
	}
	defer tf.Close()
	jpeg.Encode(tf, img, nil)
	return path, nil
}

func fixOrientation(img image.Image, o string) *image.NRGBA {
	switch o {
	case "1":
		return imaging.Clone(img)
	case "2":
		return imaging.FlipV(img)
	case "3":
		return imaging.Rotate180(img)
	case "4":
		return imaging.Rotate180(imaging.FlipV(img))
	case "5":
		return imaging.Rotate270(imaging.FlipV(img))
	case "6":
		return imaging.Rotate270(img)
	case "7":
		return imaging.Rotate90(imaging.FlipV(img))
	case "8":
		return imaging.Rotate90(img)
	default:
		log().Errorf("unknown orientation %s, expect 1-8", o)
		return imaging.Clone(img)
	}
}
