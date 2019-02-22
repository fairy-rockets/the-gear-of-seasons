package omote

import (
	"bytes"
	"encoding/json"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/web/util"

	"github.com/julienschmidt/httprouter"
)

func (srv *Server) serveMoment(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	if r.URL.Path == "/moment/search" {
		srv.serveMomentSearch(w, r, p)
		return
	}
	m := srv.shelf.LookupMoment(strings.TrimPrefix(r.URL.Path, "/moment"))
	if m == nil {
		w.WriteHeader(404)
		return
	}
	body := srv.momentCache.Fetch(m).Content()
	http.ServeContent(w, r, m.Title, m.Date, bytes.NewReader([]byte(body)))
}

func (srv *Server) serveMomentSearch(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	size, err := strconv.Atoi(r.URL.Query().Get("size"))
	if err != nil {
		size = 100
		return
	}
	pi2 := math.Pi * 2.0
	lst := make([][]*momentSummary, int(math.Ceil(math.Sqrt(float64(size)))))
	orig := srv.shelf.FindAllMoments()
	if size > len(orig) {
		size = len(orig)
	}
	for _, v := range rand.Perm(len(orig)) {
		s := srv.makeSummary(orig[v])
		i := int(math.Round(s.Angle*float64(len(lst))/pi2)) % len(lst)
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
		util.SetError(w, r, err)
		return
	}
	http.ServeContent(w, r, "search", time.Now(), bytes.NewReader(body))
}
