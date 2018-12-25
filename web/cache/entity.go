package cache

import (
	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
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
