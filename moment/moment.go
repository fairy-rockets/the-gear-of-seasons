package moment

import (
	"time"
)

type Moment struct {
	Date  time.Time `yaml:"date"`
	Title string    `yaml:"title"`
	Text  string    `yaml:"text"`
}

func (m *Moment) Path() string {
	return m.Date.Format("/2006/01/02/15:04:05/")
}
