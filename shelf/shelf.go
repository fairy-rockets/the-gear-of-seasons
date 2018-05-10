package shelf

import (
	"path/filepath"

	"github.com/FairyRockets/the-gear-of-seasons/shelf/entity"
	"github.com/FairyRockets/the-gear-of-seasons/shelf/moment"
)

// Shelf of Seasons
type Shelf struct {
	Path string

	// original data
	entities *entity.Shelf
	moments  *moment.Shelf
}

func New(path string) *Shelf {
	return &Shelf{
		Path:     path,
		entities: entity.NewShelf(filepath.Join(path, "entity")),
		moments:  moment.NewShelf(filepath.Join(path, "moment")),
	}
}

func (shelf *Shelf) Init() error {
	if err := shelf.entities.Init(); err != nil {
		return err
	}
	if err := shelf.moments.Init(); err != nil {
		return err
	}
	return nil
}

// ------------------------------------------------------------------------------------------------
//   Entities
// ------------------------------------------------------------------------------------------------

func (shelf *Shelf) NumEntities() int {
	return shelf.entities.Size()
}

func (shelf *Shelf) LookupEntity(id string) entity.Entity {
	return shelf.entities.Lookup(id)
}

func (shelf *Shelf) FindAllEntities() []entity.Entity {
	return shelf.entities.AsSlice()
}

func (shelf *Shelf) AddImageEntity(mimeType string, buffer []byte) (*entity.ImageEntity, error) {
	return shelf.entities.AddImage(mimeType, buffer)
}

// ------------------------------------------------------------------------------------------------
//   Moments
// ------------------------------------------------------------------------------------------------

func (shelf *Shelf) NumMoments() int {
	return shelf.moments.Size()
}

func (shelf *Shelf) LookupMoment(path string) *moment.Moment {
	return shelf.moments.Lookup(path)
}
func (shelf *Shelf) FindAllMoments() []*moment.Moment {
	return shelf.moments.AsSlice()
}
