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

type BaseEntity struct {
	ID_          string    `yaml:"-"`
	Path_        string    `yaml:"-"`
	Date_        time.Time `yaml:"date"`
	MimeType_    string    `yaml:"mime-type"`
	Description_ string    `yaml:"description"`
}

func (e *BaseEntity) ID() string {
	return e.ID_
}
func (e *BaseEntity) Date() time.Time {
	return e.Date_
}
func (e *BaseEntity) MimeType() string {
	return e.MimeType_
}
func (e *BaseEntity) Description() string {
	return e.Description_
}
func (e *BaseEntity) Path() string {
	return e.Path_
}

type ImageEntity struct {
	BaseEntity `yaml:",inline"`
	Width      int `yaml:"width"`
	Height     int `yaml:"height"`
}

type VideoEntity struct {
	BaseEntity `yaml:",inline"`
	Width      int `yaml:"width"`
	Height     int `yaml:"height"`
}

type AudioEntity struct {
	BaseEntity `yaml:",inline"`
}
