package web

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/web/cache"
	"github.com/julienschmidt/httprouter"
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

// ----------------------------------------------------------------------------
//  URL handlers
// ----------------------------------------------------------------------------

// /
func (srv *Server) serveAdminIndex(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	t, err := srv.parseTemplate("admin/_main.html", "admin/index.html")
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	err = t.Execute(w, nil)
	if err != nil {
		srv.setError(w, r, err)
	}

}

// 新規
func (srv *Server) serveAdminNew(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	t, err := srv.parseTemplate("admin/_main.html", "admin/edit.html")
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	err = t.Execute(w, nil)
	if err != nil {
		srv.setError(w, r, err)
	}
}

// 各モーメントの編集画面
func (srv *Server) serveAdminEdit(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	var err error
	t, err := srv.parseTemplate("admin/_main.html", "admin/edit.html")
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	m := srv.shelf.LookupMoment(r.URL.Path)
	if m == nil {
		w.WriteHeader(404)
		return
	}
	w.WriteHeader(200)
	err = t.Execute(w, momentAsPayload(m))
	if err != nil {
		srv.setError(w, r, err)
	}
}

// モーメントのプレビュー（POST）
func (srv *Server) serveAdminPreview(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	_, m, err := readMoment(r.Body)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	mc := srv.momentCache.Preview(m)
	w.WriteHeader(200)
	_, err = w.Write([]byte(mc.Content()))
	if err != nil {
		log().Error(err)
	}
}

// モーメントの保存
func (srv *Server) serveAdminSave(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	originalDate, m, err := readMoment(r.Body)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	mc := srv.momentCache.Preview(m)
	// dateの調整
	if m.Date.IsZero() {
		img := mc.FindFirstImage()
		if img != nil {
			m.Date = img.Date_
		} else {
			m.Date = time.Now()
		}
	}
	err = srv.momentCache.Save(originalDate, m)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	mc = srv.momentCache.Fetch(m)

	dat, err := json.Marshal(struct {
		Body string `json:"body"`
		Date string `json:"date"`
		Path string `json:"path"`
	}{
		Body: mc.Content(),
		Date: mc.Moment.Date.Format(payloadTimeFormat),
		Path: mc.Moment.Path(),
	})
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	w.WriteHeader(200)
	_, err = w.Write(dat)
	if err != nil {
		log().Error(err)
	}
}

// メディアのアップロード
func (srv *Server) serveAdminUpload(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	mimeType := r.Header.Get("Content-Type")
	if len(mimeType) == 0 {
		srv.setError(w, r, fmt.Errorf("empty Content-Type"))
		return
	}
	switch mimeType {
	case "image/jpeg", "image/png", "image/gif":
		/* Image */
		buffer, err := ioutil.ReadAll(r.Body)
		if err != nil {
			srv.setError(w, r, err)
			return
		}
		img, err := srv.shelf.AddImageEntity(mimeType, buffer)
		if err != nil {
			srv.setError(w, r, err)
			break
		}
		_, err = srv.entityCache.FetchMediumThumbnail(img)
		if err != nil {
			srv.setError(w, r, err)
			break
		}
		_, err = srv.entityCache.FetchIcon(img)
		if err != nil {
			srv.setError(w, r, err)
			break
		}
		w.WriteHeader(200)
		_, err = fmt.Fprintf(w, `[image entity="%s"]`, img.ID_)
		if err != nil {
			log().Error(err)
		}
	case "video/mp4", "video/x-matroska":
		/* Video */
		vid, err := srv.shelf.AddVideoEntity(mimeType, r.Body)
		if err != nil {
			srv.setError(w, r, err)
			break
		}
		w.WriteHeader(200)
		_, err = fmt.Fprintf(w, `[video entity="%s"]`, vid.ID_)
		if err != nil {
			log().Error(err)
		}
	default:
		w.WriteHeader(501)
		_, err := fmt.Fprintf(w, "Unknown Mime-Type: %s\n", mimeType)
		if err != nil {
			log().Error(err)
		}
	}
}

// モーメント一覧（今年のにリダイレクト）
func (srv *Server) serveAdminMoments(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	http.Redirect(w, r, fmt.Sprintf("/moments/%d", time.Now().Year()), 302)
}

// 年別モーメントの一覧
func (srv *Server) serveAdminMomentLists(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
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
	mcs := make([]*cache.MomentCache, 0, len(ms))
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
		Moments  []*cache.MomentCache
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

// エンティティ一覧（今年のにリダイレクト）
func (srv *Server) serveAdminEntities(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	http.Redirect(w, r, fmt.Sprintf("/entities/%d", time.Now().Year()), 302)
}

// 年別エンティティの一覧
func (srv *Server) serveAdminEntityLists(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
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

func (srv *Server) serveAdminDeleteEntity(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	var err error
	ent := srv.shelf.LookupEntity(id)
	if ent == nil {
		w.WriteHeader(404)
		_, _ = w.Write([]byte("Not found."))
		return
	}
	err = srv.entityCache.Remove(ent)
	if ent != nil {
		srv.setError(w, r, err)
		return
	}
}
