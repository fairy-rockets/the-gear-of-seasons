package cache

import (
	"fmt"
	"image"
	"image/jpeg"
	"os"
	"path/filepath"
	"strconv"

	"github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
	"github.com/oliamb/cutter"
	"go.uber.org/zap"
)

func (cache *EntityCache) FetchIcon(ent shelf.Entity) (string, error) {
	e, ok := ent.(*shelf.ImageEntity)
	if !ok {
		return "", fmt.Errorf("%s is not an image", e.SystemPath())
	}
	if url, ok := cache.lookupThumbnail(e, IconType); ok {
		return url, nil
	}
	img, err := generateThumbnail(e, IconSize)
	if err != nil {
		err = fmt.Errorf("failed to generate icon %s: %v", e.SystemPath(), err)
		return "", err
	}
	img, err = cutter.Crop(img, cutter.Config{
		Width:  IconSize,
		Height: IconSize,
		Mode:   cutter.Centered,
	})
	if err != nil {
		err = fmt.Errorf("failed to cut %s: %v", e.SystemPath(), err)
		return "", err
	}
	path, err := cache.saveThumbnail(e, IconType, img)
	if err != nil {
		err = fmt.Errorf("failed to save icon %s: %v", e.SystemPath(), err)
		return "", err
	}
	return path, nil
}

func (cache *EntityCache) FetchMediumThumbnail(ent shelf.Entity) (string, error) {
	e, ok := ent.(*shelf.ImageEntity)
	if !ok {
		return "", fmt.Errorf("%s is not an image", e.SystemPath())
	}
	if url, ok := cache.lookupThumbnail(e, MediumType); ok {
		return url, nil
	}
	img, err := generateThumbnail(e, MediumSize)
	if err != nil {
		err = fmt.Errorf("failed to generate icon %s: %v", e.SystemPath(), err)
		return "", err
	}
	path, err := cache.saveThumbnail(e, MediumType, img)
	if err != nil {
		err = fmt.Errorf("failed to save icon %s: %v", e.SystemPath(), err)
		return "", err
	}
	return path, nil
}

func (cache *EntityCache) removeImage(e *shelf.ImageEntity) error {

	return nil //cache.shelf.Remove(e)
}

// ----------------------------------------------------------------------------

func (cache *EntityCache) thumbnailPathOf(e *shelf.ImageEntity, thumbType string) string {
	return filepath.Join(cache.path, thumbType, strconv.Itoa(e.Date_.Year()), e.ID_+".jpg")
}

func (cache *EntityCache) lookupThumbnail(e *shelf.ImageEntity, thumbType string) (string, bool) {
	path := cache.thumbnailPathOf(e, thumbType)
	_, err := os.Stat(path)
	return path, err == nil
}

func (cache *EntityCache) saveThumbnail(e *shelf.ImageEntity, thumbType string, img image.Image) (string, error) {
	log := zap.L()
	var err error
	path := cache.thumbnailPathOf(e, thumbType)
	if err = os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		err = fmt.Errorf("failed to prepare dir for %s: %v", path, err)
		return "", err
	}
	f, err := os.Create(path)
	if err != nil {
		err = fmt.Errorf("failed to create %s: %v", path, err)
		return "", err
	}
	defer f.Close()
	err = jpeg.Encode(f, img, &jpeg.Options{Quality: 85})
	if err != nil {
		err = fmt.Errorf("failed to encode thumbnail: %v", err)
		return "", err
	}
	err = os.Chtimes(path, e.Date_, e.Date_)
	if err != nil {
		log.Error("Failed to change time", zap.String("path", path), zap.Error(err))
	}
	return path, nil
}
