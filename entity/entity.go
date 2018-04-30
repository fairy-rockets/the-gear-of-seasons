package entity

import (
	"time"
)

type Entity interface {
	GetID() string
	GetDate() time.Time
	GetMimeType() string
	GetDescription() string
	GetPath() string
}

type BaseEntity struct {
	ID          string    `yaml:"id"`
	Date        time.Time `yaml:"date"`
	MimeType    string    `yaml:"mime-type"`
	Description string    `yaml:"description"`
	Path        string    `yaml:"-"`
}

func (e *BaseEntity) GetID() string {
	return e.ID
}
func (e *BaseEntity) GetDate() time.Time {
	return e.Date
}
func (e *BaseEntity) GetMimeType() string {
	return e.MimeType
}
func (e *BaseEntity) GetDescription() string {
	return e.Description
}
func (e *BaseEntity) GetPath() string {
	return e.Path
}

type ImageEntity struct {
	BaseEntity `yaml:"entity"`
	Width      int `yaml:"width"`
	Height     int `yaml:"height"`
}

type VideoEntity struct {
	BaseEntity `yaml:"entity"`
	Width      int `yaml:"width"`
	Height     int `yaml:"height"`
}

type AudioEntity struct {
	BaseEntity `yaml:"entity"`
}
