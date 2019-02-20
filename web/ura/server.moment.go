package ura

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/web/cache"
	"github.com/julienschmidt/httprouter"
)

// モーメント一覧（今年のにリダイレクト）
func (srv *Server) serveMoments(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	http.Redirect(w, r, fmt.Sprintf("/moments/%d", time.Now().Year()), 302)
}

// 年別モーメントの一覧
func (srv *Server) serveMomentsLists(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	t, err := srv.parseTemplate("admin/_main.html", "admin/moments.html")
	if err != nil {
		srv.setError(w, r, err)
		return
	}

	w.WriteHeader(200)
	year, err := strconv.Atoi(p.ByName("year"))
	if err != nil {
		year = time.Now().Year()
	}
	ms := srv.shelf.FindAllMomentsByYear(year)
	mcs := make([]*cache.MomentCacheItem, 0, len(ms))
	for _, m := range ms {
		mcs = append(mcs, srv.momentCache.Fetch(m))
	}
	sort.Slice(mcs, func(i, j int) bool {
		return mcs[i].Moment.Date.After(mcs[j].Moment.Date)
	})
	err = t.Execute(w, struct {
		LastYear int
		Year     int
		NextYear int
		Moments  []*cache.MomentCacheItem
	}{
		LastYear: year - 1,
		Year:     year,
		NextYear: year + 1,
		Moments:  mcs,
	})
	if err != nil {
		srv.setError(w, r, err)
	}
}
