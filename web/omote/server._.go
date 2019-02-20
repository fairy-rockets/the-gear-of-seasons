package omote

import (
	"fmt"
	"net/http"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/web"
	"github.com/fairy-rockets/the-gear-of-seasons/web/cache"
	"github.com/julienschmidt/httprouter"
)

type Server struct {
	// 特有
	impl   *http.Server
	router *httprouter.Router
	// 共用
	shelf       *shelf.Shelf
	entityCache *cache.EntityCache
	momentCache *cache.MomentCache
}

func NewServer(listen string, shelf *shelf.Shelf, entityCache *cache.EntityCache, momentCache *cache.MomentCache) *Server {
	srv := &Server{
		router:      httprouter.New(),
		shelf:       shelf,
		entityCache: entityCache,
		momentCache: momentCache,
	}
	srv.impl = &http.Server{
		Addr:    listen,
		Handler: srv.router,
	}
	srv.setupRoute()
	return srv
}

func (srv *Server) setupRoute() {
	r := srv.router
	r.NotFound = srv

	// index
	r.GET("/", srv.serveIndex)
	r.GET("/about-us/", srv.serveIndex)

	// entity
	r.GET("/entity/:id", srv.serveEntity)
	r.GET("/entity/:id/icon", srv.serveEntityIcon)
	r.GET("/entity/:id/medium", srv.serveEntityMedium)

	// moment
	r.GET("/moment/*moment", srv.serveMoment)

	// static
	r.ServeFiles("/static/*filepath", http.Dir(web.StaticPath))
}

func (srv *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		m := srv.shelf.LookupMoment(r.URL.Path)
		if m != nil {
			srv.serveIndex(w, r, nil)
			return
		}
	}
	w.WriteHeader(404)
	_, _ = fmt.Fprintf(w, "404: Page not found.")
}
