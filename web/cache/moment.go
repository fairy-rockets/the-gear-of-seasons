package cache

import (
	"bytes"
	"fmt"
	"sync"

	"github.com/fairy-rockets/the-gear-of-seasons/fml"

	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
)

type MomentCacheShelf struct {
	shelf   *shelf.Shelf
	mutex   sync.Mutex
	entries map[string]*MomentCache
}

func NewMomentCacheShelf(sh *shelf.Shelf) *MomentCacheShelf {
	return &MomentCacheShelf{
		shelf:   sh,
		entries: make(map[string]*MomentCache),
	}
}

type MomentCache struct {
	Moment *shelf.Moment
	body   string
	embeds []shelf.Entity
}

const contentFormat = `
<div class="moment-info">
	<h1 class="moment-title">%s</h1>
	<span class="moment-date">%s</span>
	<span class="moment-author">%s</span>
</div>
<hr>
%s`

func (cache *MomentCache) Content() string {
	return fmt.Sprintf(contentFormat,
		cache.Moment.Title,
		cache.Moment.DateString(),
		cache.Moment.Author,
		cache.body)
}

func (cache *MomentCache) Embeds() []shelf.Entity {
	return cache.embeds
}

func (cache *MomentCache) FindFirstImage() *shelf.ImageEntity {
	for _, e := range cache.embeds {
		if img, ok := e.(*shelf.ImageEntity); ok {
			return img
		}
	}
	return nil
}

func (cache *MomentCacheShelf) lookup(m *shelf.Moment) (*MomentCache, bool) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	entry, ok := cache.entries[cache.keyOf(m.Date)]
	return entry, ok
}

func (cache *MomentCacheShelf) set(m *shelf.Moment, entry *MomentCache) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	cache.entries[cache.keyOf(m.Date)] = entry
}

func (cache *MomentCacheShelf) Fetch(m *shelf.Moment) *MomentCache {
	if cached, ok := cache.lookup(m); ok {
		return cached
	}
	cached := cache.compile(m)
	cache.set(m, cached)
	return cached
}

func (cache *MomentCacheShelf) Preview(m *shelf.Moment) *MomentCache {
	return cache.compile(m)
}

func (cache *MomentCacheShelf) keyOf(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

func (cache *MomentCacheShelf) Save(origTime time.Time, m *shelf.Moment) error {
	var err error

	cache.mutex.Lock()
	defer cache.mutex.Unlock()

	if !origTime.IsZero() {
		delete(cache.entries, cache.keyOf(origTime))
	}
	err = cache.shelf.SaveMoment(origTime, m)
	if err != nil {
		return err
	}

	return nil
}

const EmptyEntityIDMessage = `<strong class="error">No entity field</strong>`
const EmptyURLMessage = `<strong class="error">No url field</strong>`

func (cache *MomentCacheShelf) compile(m *shelf.Moment) *MomentCache {
	embeds := make([]shelf.Entity, 0)
	uta, err := fml.NewParser().Parse(m.Text)
	if err != nil {
		return &MomentCache{
			Moment: m,
			body:   err.Error(),
			embeds: embeds,
		}
	}

	var buff bytes.Buffer
	for _, renI := range uta.Rens {
		switch ren := renI.(type) {
		case fml.Text:
			buff.WriteString(fmt.Sprintf(`<p>%s</p>`, ren.ToString()))
		case *fml.Image:
			if ren.EntityID == "" {
				buff.WriteString(EmptyEntityIDMessage)
				continue
			}
			img, ok := cache.shelf.LookupEntity(ren.EntityID).(*shelf.ImageEntity)
			if !ok {
				buff.WriteString(fmt.Sprintf(`<p><strong class="error">Entity[%s] is not an image.</strong></p>`, ren.EntityID))
				continue
			}
			embeds = append(embeds, img)
			url := fmt.Sprintf("/entity/%s", ren.EntityID)
			src := fmt.Sprintf("/entity/%s/medium", ren.EntityID)
			if ren.LinkURL != "" {
				url = ren.LinkURL
			}
			w, h := calcImageSizeWithMinLength(uint(img.Width), uint(img.Height), MediumSize)
			buff.WriteString(fmt.Sprintf(`<a href="%s"><img src="%s" class="embed" width="%d" height="%d"></a><p></p>`, url, src, w, h))
		case *fml.Video:
			if ren.EntityID == "" {
				buff.WriteString(EmptyEntityIDMessage)
				continue
			}
			vid, ok := cache.shelf.LookupEntity(ren.EntityID).(*shelf.VideoEntity)
			if !ok {
				buff.WriteString(fmt.Sprintf(`<p><strong class="error">Entity[%s] is not a video.</strong></p>`, ren.EntityID))
				continue
			}
			embeds = append(embeds, vid)
			url := fmt.Sprintf("/entity/%s", ren.EntityID)
			buff.WriteString(fmt.Sprintf(`<video width="%d" height="%d" preload="metadata" controls="controls"><source type="%s" src="%s" /><a href="%s">Click to play.</a></video>`, vid.Width, vid.Height, vid.MimeType_, url, url))
		case *fml.Audio:
			if ren.EntityID == "" {
				buff.WriteString(EmptyEntityIDMessage)
				continue
			}
			audio, ok := cache.shelf.LookupEntity(ren.EntityID).(*shelf.AudioEntity)
			if !ok {
				buff.WriteString(fmt.Sprintf(`<p><strong class="error">Entity[%s] is not an audio.</strong></p>`, ren.EntityID))
				continue
			}
			embeds = append(embeds, audio)
			url := fmt.Sprintf(`/entity/%s`, ren.EntityID)
			buff.WriteString(fmt.Sprintf(`<audio src="%s" preload="auto" controls>`, url))
		case *fml.Link:
			if ren.EntityID == "" {
				buff.WriteString(EmptyEntityIDMessage)
				continue
			}
			url := fmt.Sprintf("/entity/%s", ren.EntityID)
			text := url
			if ren.Text != "" {
				text = ren.Text
			}
			buff.WriteString(fmt.Sprintf(`<p><a href="%s">%s</a></p>`, url, text))
		case *fml.Markdown:
			if ren.URL == "" {
				buff.WriteString(EmptyURLMessage)
				continue
			}
		}
	}

	body := buff.String()

	return &MomentCache{
		Moment: m,
		body:   body,
		embeds: embeds,
	}

}
