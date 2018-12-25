package shelf

import (
	"time"
)

type Entity interface {
	ID() string
	Date() time.Time
	MimeType() string
	Description() string
	Path() string
}

type entity struct {
	ID_          string    `yaml:"-"`
	Path_        string    `yaml:"-"`
	Date_        time.Time `yaml:"date"`
	MimeType_    string    `yaml:"mime-type"`
	Description_ string    `yaml:"description"`
}

func (e *entity) ID() string {
	return e.ID_
}
func (e *entity) Date() time.Time {
	return e.Date_
}
func (e *entity) MimeType() string {
	return e.MimeType_
}
func (e *entity) Description() string {
	return e.Description_
}
func (e *entity) Path() string {
	return e.Path_
}

type ImageEntity struct {
	entity `yaml:",inline"`
	Width  int `yaml:"width"`
	Height int `yaml:"height"`
}

type VideoEntity struct {
	entity   `yaml:",inline"`
	Width    int     `yaml:"width"`
	Height   int     `yaml:"height"`
	Duration float64 `yaml:"duraton"`
}

type AudioEntity struct {
	entity `yaml:",inline"`
}
