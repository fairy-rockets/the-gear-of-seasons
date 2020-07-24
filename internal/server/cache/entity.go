package cache

import (
	"fmt"
	"reflect"

	"github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
)

const (
	IconSize = 256
	IconType = "icon"

	MediumSize = 2048
	MediumType = "medium"
)

type EntityCache struct {
	shelf *shelf.Shelf
	path  string
}

func NewEntityCache(shelf *shelf.Shelf, path string) *EntityCache {
	return &EntityCache{
		shelf: shelf,
		path:  path,
	}
}

func (cache *EntityCache) Remove(entity shelf.Entity) error {
	switch e := entity.(type) {
	case *shelf.ImageEntity:
		return cache.removeImage(e)
	case *shelf.VideoEntity:
		return cache.removeVideo(e)
	}
	return fmt.Errorf("unsupported entity type: %v(type:%s)", entity, reflect.TypeOf(entity))
}
