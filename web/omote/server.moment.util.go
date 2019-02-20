package omote

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
)

type momentSummary struct {
	Angle    float64 `json:"angle"`
	Date     string  `json:"date"`
	Title    string  `json:"title"`
	Path     string  `json:"path"`
	ImageURL string  `json:"imageURL"`
	BodyURL  string  `json:"bodyURL"`
}

func (srv *Server) makeSummary(m *shelf.Moment) *momentSummary {
	var err error
	var img *shelf.ImageEntity
	img = srv.momentCache.Fetch(m).FindFirstImage()
	beg := time.Date(m.Date.Year(), time.January, 1, 0, 0, 0, 0, m.Date.Location())
	end := time.Date(m.Date.Year()+1, time.January, 1, 0, 0, 0, 0, m.Date.Location())
	angle := float64(m.Date.Sub(beg)) / float64(end.Sub(beg))

	imageURL := ""
	if img != nil {
		_, err = srv.entityCache.FetchIcon(img)
		if err == nil {
			imageURL = fmt.Sprintf("/entity/%s/icon", img.ID())
		}
	}

	return &momentSummary{
		Angle:    angle * math.Pi * 2,
		Date:     strings.Replace(m.DateString(), "\n", "<br>", -1),
		Title:    m.Title,
		Path:     m.Path(),
		ImageURL: imageURL,
		BodyURL:  fmt.Sprintf("/moment%s", m.Path()),
	}
}
