package web

import (
	"fmt"
	"html/template"
	"net/http"
	"time"

	"path/filepath"

	"github.com/Sirupsen/logrus"
	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/web/cache"
	"github.com/julienschmidt/httprouter"
	"golang.org/x/net/context"
)

const (
	StaticPath    = "_resources/static"
	TemplatesPath = "_resources/templates"
)

type Server struct {
	omoteImpl   *http.Server
	uraImpl     *http.Server
	omoteRouter *httprouter.Router
	uraRouter   *httprouter.Router
	shelf       *shelf.Shelf
	entityCache *cache.EntityCacheShelf
	momentCache *cache.MomentCacheShelf
}

func log() *logrus.Entry {
	return logrus.WithField("Module", "Web")
}

func NewServer(listenOmote, listenUra string, shelf *shelf.Shelf, cachePath string) *Server {
	srv := &Server{
		omoteRouter: httprouter.New(),
		uraRouter:   httprouter.New(),
		shelf:       shelf,
		entityCache: cache.NewEntityCacheShelf(shelf, filepath.Join(cachePath, "entity")),
		momentCache: cache.NewMomentCacheShelf(shelf),
	}
	srv.omoteImpl = &http.Server{
		Addr:    listenOmote,
		Handler: srv.omoteRouter,
	}
	srv.uraImpl = &http.Server{
		Addr:    listenUra,
		Handler: srv.uraRouter,
	}
	srv.setupRoute()
	return srv
}

func (srv *Server) setupRoute() {
	omote := srv.omoteRouter
	omote.GET("/", srv.serveIndex)
	omote.GET("/about-us/", srv.serveIndex)
	omote.GET("/entity/:id", srv.serveEntity)
	omote.GET("/entity/:id/icon", srv.serveEntityIcon)
	omote.GET("/entity/:id/medium", srv.serveEntityMedium)
	omote.GET("/moment/*moment", srv.serveMoment)
	omote.ServeFiles("/static/*filepath", http.Dir(StaticPath))
	omote.NotFound = srv

	ura := srv.uraRouter
	ura.GET("/", srv.serveAdminIndex)
	ura.GET("/new", srv.serveAdminNew)
	ura.POST("/upload", srv.serveAdminUpload)
	ura.POST("/preview", srv.serveAdminEditPreview)
	ura.ServeFiles("/static/*filepath", http.Dir(StaticPath))

	ura.NotFound = srv
}

func (srv *Server) Prepare() error {
	var err error
	ents := srv.shelf.FindAllEntities()
	for i, ent := range ents {
		switch e := ent.(type) {
		case *shelf.ImageEntity:
			if _, err = srv.entityCache.FetchIcon(e); err != nil {
				return err
			}
			if _, err = srv.entityCache.FetchMedium(e); err != nil {
				return err
			}
		default:
			/* Nothing to do */
		}
		log().Infof("Entity[%d/%d] prepared.", i+1, len(ents))
	}
	return nil
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
	fmt.Fprintf(w, "404: Page not found.")
}

func (srv *Server) Start() error {
	log().Infof("Start Omote Server at %s", srv.omoteImpl.Addr)
	err := srv.omoteImpl.ListenAndServe()
	if err == http.ErrServerClosed {
		err = nil
	}
	return err
}

func (srv *Server) Stop() error {
	ctx, _ := context.WithTimeout(context.Background(), time.Second*5)
	return srv.omoteImpl.Shutdown(ctx)
}

func (srv *Server) setError(w http.ResponseWriter, r *http.Request, err error) {
	w.WriteHeader(503)
	fmt.Fprintf(w, "[Error] %v", err)
}

func (srv *Server) templateOf(files ...string) (*template.Template, error) {
	for i := range files {
		files[i] = fmt.Sprintf("%s/%s", TemplatesPath, files[i])
	}
	return template.ParseFiles(files...)
}
