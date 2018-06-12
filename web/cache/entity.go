package cache

import (
	"image/jpeg"
	"os"

	"path/filepath"

	"fmt"

	"strconv"

	"image"

	"github.com/FairyRockets/the-gear-of-seasons/shelf"
	"github.com/oliamb/cutter"
)

const (
	IconSize = 256
	IconType = "icon"

	MediumSize = 2048
	MediumType = "medium"
)

type EntityCacheShelf struct {
	shelf *shelf.Shelf
	path  string
}

func NewEntityCacheShelf(shelf *shelf.Shelf, path string) *EntityCacheShelf {
	return &EntityCacheShelf{
		shelf: shelf,
		path:  path,
	}
}

func (cache *EntityCacheShelf) pathOf(e *shelf.ImageEntity, thumbType string) string {
	return filepath.Join(cache.path, thumbType, strconv.Itoa(e.Date.Year()), e.ID+".jpg")
}

func (cache *EntityCacheShelf) lookup(e *shelf.ImageEntity, thumbType string) (string, bool) {
	path := cache.pathOf(e, thumbType)
	_, err := os.Stat(path)
	return path, err == nil
}

func (cache *EntityCacheShelf) save(e *shelf.ImageEntity, thumbType string, img image.Image) (string, error) {
	var err error
	path := cache.pathOf(e, thumbType)
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
	os.Chtimes(path, e.Date, e.Date)
	return path, nil
}

func (cache *EntityCacheShelf) FetchIcon(ent shelf.Entity) (string, error) {
	e, ok := ent.(*shelf.ImageEntity)
	if !ok {
		return "", fmt.Errorf("%s is not an image", e.GetPath())
	}
	if url, ok := cache.lookup(e, IconType); ok {
		return url, nil
	}
	img, err := generateThumbnail(e, IconSize)
	if err != nil {
		err = fmt.Errorf("failed to generate icon %s: %v", e.GetPath(), err)
		return "", err
	}
	img, err = cutter.Crop(img, cutter.Config{
		Width:  IconSize,
		Height: IconSize,
		Mode:   cutter.Centered,
	})
	if err != nil {
		err = fmt.Errorf("failed to cut %s: %v", e.GetPath(), err)
		return "", err
	}
	path, err := cache.save(e, IconType, img)
	if err != nil {
		err = fmt.Errorf("failed to save icon %s: %v", e.GetPath(), err)
		return "", err
	}
	return path, nil
}

func (cache *EntityCacheShelf) FetchMedium(ent shelf.Entity) (string, error) {
	e, ok := ent.(*shelf.ImageEntity)
	if !ok {
		return "", fmt.Errorf("%s is not an image", e.GetPath())
	}
	if url, ok := cache.lookup(e, MediumType); ok {
		return url, nil
	}
	img, err := generateThumbnail(e, MediumSize)
	if err != nil {
		err = fmt.Errorf("failed to generate icon %s: %v", e.GetPath(), err)
		return "", err
	}
	path, err := cache.save(e, MediumType, img)
	if err != nil {
		err = fmt.Errorf("failed to save icon %s: %v", e.GetPath(), err)
		return "", err
	}
	return path, nil
}
