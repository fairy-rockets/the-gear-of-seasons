package web

import (
	"net/http"

	"strconv"

	"math/rand"

	"time"

	"encoding/json"

	"math"

	"fmt"

	"github.com/FairyRockets/the-gear-of-seasons/entity"
	"github.com/FairyRockets/the-gear-of-seasons/moment"
	"github.com/julienschmidt/httprouter"
)

func (srv *Web) serveMoment(w http.ResponseWriter, r *http.Request, m *moment.Moment) {
	w.WriteHeader(200)
	body, _ := srv.momentCache.Fetch(m)
	w.Write([]byte(body))
}

type momentSummary struct {
	Angle float64   `json:"angle"`
	Date  time.Time `json:"date"`
	Title string    `json:"title"`
	Image string    `json:"image"`
}

func (srv *Web) makeSummary(m *moment.Moment) *momentSummary {
	var err error
	_, entities := srv.momentCache.Fetch(m)
	var img *entity.ImageEntity
	for _, e := range entities {
		var ok bool
		if img, ok = e.(*entity.ImageEntity); ok {
			break
		}
	}
	beg := time.Date(m.Date.Year(), time.January, 1, 0, 0, 0, 0, m.Date.Location())
	end := time.Date(m.Date.Year()+1, time.January, 1, 0, 0, 0, 0, m.Date.Location())
	angle := float64(m.Date.Sub(beg)) / float64(end.Sub(beg))

	imageData := ""
	if img != nil {
		_, err = srv.entityCache.FetchThumbnail(img)
		if err == nil {
			imageData = fmt.Sprintf("/entity/%s/thumbnail", img.GetID())
		}
	}

	return &momentSummary{
		Angle: angle * math.Pi * 2,
		Date:  m.Date,
		Title: m.Title,
		Image: imageData,
	}
}

func (srv *Web) serveMomentSearch(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	size, err := strconv.Atoi(r.URL.Query().Get("size"))
	if err != nil {
		size = 100
		return
	}
	orig := srv.moments.AsSlice()
	out := make([]*momentSummary, size)
	for i, v := range rand.Perm(len(orig)) {
		if i >= size {
			break
		}
		out[i] = srv.makeSummary(orig[v])
	}
	body, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	w.Write(body)
}
