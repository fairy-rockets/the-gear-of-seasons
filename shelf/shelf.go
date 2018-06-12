package shelf

import (
	"path/filepath"
)

// MomentShelf of Seasons
type Shelf struct {
	Path string

	// original data
	entities *EntityShelf
	moments  *MomentShelf
}

func New(path string) *Shelf {
	return &Shelf{
		Path:     path,
		entities: newEntityShelf(filepath.Join(path, "entity")),
		moments:  newMomentShelf(filepath.Join(path, "moment")),
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

func (shelf *Shelf) LookupEntity(id string) Entity {
	return shelf.entities.Lookup(id)
}

func (shelf *Shelf) FindAllEntities() []Entity {
	return shelf.entities.AsSlice()
}

func (shelf *Shelf) AddImageEntity(mimeType string, buffer []byte) (*ImageEntity, error) {
	return shelf.entities.AddImage(mimeType, buffer)
}

// ------------------------------------------------------------------------------------------------
//   Moments
// ------------------------------------------------------------------------------------------------

func (shelf *Shelf) NumMoments() int {
	return shelf.moments.Size()
}

func (shelf *Shelf) LookupMoment(path string) *Moment {
	return shelf.moments.Lookup(path)
}
func (shelf *Shelf) FindAllMoments() []*Moment {
	return shelf.moments.AsSlice()
}
