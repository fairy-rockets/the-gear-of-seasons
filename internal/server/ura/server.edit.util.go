package ura

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
)

type momentPayload struct {
	Date         string `json:"date"`
	OriginalDate string `json:"original_date"`
	Title        string `json:"title"`
	Author       string `json:"author"`
	Text         string `json:"text"`
}

const payloadTimeFormat = "2006/01/02 15:04:05"

func readMoment(r io.Reader) (time.Time, *shelf.Moment, error) {
	data, err := ioutil.ReadAll(r)
	if err != nil {
		return time.Time{}, nil, err
	}
	p := new(momentPayload)
	err = json.Unmarshal(data, p)
	if err != nil {
		return time.Time{}, nil, err
	}
	m := &shelf.Moment{}
	m.Author = p.Author
	m.Text = p.Text
	m.Title = p.Title
	if p.Date != "" {
		t, err := time.Parse(payloadTimeFormat, p.Date)
		if err == nil {
			m.Date = t
		}
	}
	var origTime time.Time
	if p.OriginalDate != "" {
		t, err := time.Parse(payloadTimeFormat, p.OriginalDate)
		if err == nil {
			origTime = t
		}
	}

	return origTime, m, nil
}

func momentAsPayload(m *shelf.Moment) *momentPayload {
	p := new(momentPayload)
	p.Author = m.Author
	p.Text = m.Text
	p.Title = m.Title
	p.Date = m.Date.Format(payloadTimeFormat)
	p.OriginalDate = p.Date
	return p
}
