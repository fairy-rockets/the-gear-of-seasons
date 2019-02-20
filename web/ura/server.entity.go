package ura

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
	"github.com/julienschmidt/httprouter"
)

// エンティティ一覧（今年のにリダイレクト）
func (srv *Server) serveEntities(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	http.Redirect(w, r, fmt.Sprintf("/entities/%d", time.Now().Year()), 302)
}

// 年別エンティティの一覧
func (srv *Server) serveEntitiesLists(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	funcs := make(map[string]interface{})
	funcs["isImage"] = func(entity shelf.Entity) bool {
		_, ok := entity.(*shelf.ImageEntity)
		return ok
	}
	funcs["isVideo"] = func(entity shelf.Entity) bool {
		_, ok := entity.(*shelf.VideoEntity)
		return ok
	}
	t, err := srv.parseTemplateWithFuncs(funcs, "admin/_main.html", "admin/entities.html")
	if err != nil {
		srv.setError(w, r, err)
		return
	}

	year, err := strconv.Atoi(p.ByName("year"))
	if err != nil {
		year = time.Now().Year()
	}
	es := srv.shelf.FindAllEntitiesByYear(year)
	sort.Slice(es, func(i, j int) bool {
		return es[i].Date().After(es[j].Date())
	})
	w.WriteHeader(200)
	err = t.Execute(w, struct {
		LastYear int
		Year     int
		NextYear int
		Entities []shelf.Entity
	}{
		LastYear: year - 1,
		Year:     year,
		NextYear: year + 1,
		Entities: es,
	})
	if err != nil {
		srv.setError(w, r, err)
	}
}
