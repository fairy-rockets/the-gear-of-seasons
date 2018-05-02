package web

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/FairyRockets/the-gear-of-seasons/entity"
	"github.com/FairyRockets/the-gear-of-seasons/moment"
	"github.com/julienschmidt/httprouter"
)

func (srv *Web) serveMoment(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	if r.URL.Path == "/moment/search" {
		srv.serveMomentSearch(w, r, p)
		return
	}
	m := srv.moments.Lookup(strings.TrimPrefix(r.URL.Path, "/moment"))
	if m == nil {
		w.WriteHeader(404)
		return
	}
	w.WriteHeader(200)
	body, _ := srv.momentCache.Fetch(m)
	w.Write([]byte(body))
}

type momentSummary struct {
	Angle     float64 `json:"angle"`
	Date      string  `json:"date"`
	Title     string  `json:"title"`
	Image     string  `json:"image"`
	URL       string  `json:"url"`
	Permalink string  `json:"permalink"`
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

	imageURL := ""
	if img != nil {
		_, err = srv.entityCache.FetchThumbnail(img)
		if err == nil {
			imageURL = fmt.Sprintf("/entity/%s/thumbnail", img.GetID())
		}
	}

	return &momentSummary{
		Angle:     angle * math.Pi * 2,
		Date:      strings.Replace(m.DateString(), "\n", "<br>", -1),
		Title:     m.Title,
		Permalink: m.Path(),
		Image:     imageURL,
		URL:       fmt.Sprintf("/moment%s", m.Path()),
	}
}

func (srv *Web) serveMomentSearch(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	size, err := strconv.Atoi(r.URL.Query().Get("size"))
	if err != nil {
		size = 100
		return
	}
	pi2 := math.Pi * 2.0
	lst := make([][]*momentSummary, size)
	orig := srv.moments.AsSlice()
	if size > len(orig) {
		size = len(orig)
	}
	for _, v := range rand.Perm(len(orig)) {
		s := srv.makeSummary(orig[v])
		i := int(math.Floor(s.Angle * float64(size) / pi2))
		lst[i] = append(lst[i], s)
	}
	out := make([]*momentSummary, size)
	cnt := 0
	step := 0
end:
	for cnt < size {
		for _, v := range lst {
			if step < len(v) {
				out[cnt] = v[step]
				cnt++
				if cnt >= size {
					break end
				}
			}
		}
		step++
	}
	body, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	w.Write(body)
}
