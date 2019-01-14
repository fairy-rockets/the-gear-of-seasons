package shelf

import (
	"io"
	"path/filepath"
	"time"
)

// 季節の書架
type Shelf struct {
	Path string

	// original data
	entities *entityShelf
	moments  *momentShelf
}

func New(path string) *Shelf {
	return &Shelf{
		Path:     path,
		entities: newEntityShelf(filepath.Join(path, "entity")),
		moments:  newMomentShelf(filepath.Join(path, "moment")),
	}
}

func (shelf *Shelf) Init() error {
	var err error
	// Entity
	err = shelf.entities.Init()
	if err != nil {
		return err
	}
	// Moment
	err = shelf.moments.Init()
	if err != nil {
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

func (shelf *Shelf) FindAllEntitiesByYear(year int) []Entity {
	es := make([]Entity, 0, 100)
	for _, e := range shelf.entities.entities {
		if e.Date().Year() == year {
			es = append(es, e)
		}
	}
	return es
}

func (shelf *Shelf) AddImageEntity(mimeType string, buffer []byte) (*ImageEntity, error) {
	return shelf.entities.AddImage(mimeType, buffer)
}

func (shelf *Shelf) AddVideoEntity(mimeType string, r io.Reader) (*VideoEntity, error) {
	return shelf.entities.AddVideo(mimeType, r)
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

func (shelf *Shelf) FindAllMomentsByYear(year int) []*Moment {
	ms := make([]*Moment, 0, 100)
	for _, m := range shelf.moments.moments {
		if m.Date.Year() == year {
			ms = append(ms, m)
		}
	}
	return ms
}

func (shelf *Shelf) SaveMoment(origTime time.Time, m *Moment) error {
	return shelf.moments.Save(origTime, m)
}
