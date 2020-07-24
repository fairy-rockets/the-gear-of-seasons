package cache

import (
	"bytes"
	"fmt"
	"sync"

	"github.com/fairy-rockets/the-gear-of-seasons/fml"

	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
)

type MomentCache struct {
	shelf   *shelf.Shelf
	mutex   sync.Mutex
	entries map[string]*MomentCacheItem
}

type MomentCacheItem struct {
	Moment *shelf.Moment
	body   string
	embeds []shelf.Entity
}

func NewMomentCache(shelf *shelf.Shelf) *MomentCache {
	return &MomentCache{
		shelf:   shelf,
		entries: make(map[string]*MomentCacheItem),
	}
}

func (cache *MomentCacheItem) Content() string {
	const htmlFormat = `
<div class="moment-info">
	<h1 class="moment-title title">%s</h1>
	<span class="moment-date">%s</span>
	<span class="moment-author">%s</span>
</div>
<hr>
%s`
	return fmt.Sprintf(htmlFormat,
		cache.Moment.Title,
		cache.Moment.DateString(),
		cache.Moment.Author,
		cache.body)
}

func (cache *MomentCacheItem) Embeds() []shelf.Entity {
	return cache.embeds
}

func (cache *MomentCacheItem) FindFirstImage() *shelf.ImageEntity {
	for _, e := range cache.embeds {
		if img, ok := e.(*shelf.ImageEntity); ok {
			return img
		}
	}
	return nil
}

func (cache *MomentCache) lookup(m *shelf.Moment) (*MomentCacheItem, bool) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	entry, ok := cache.entries[cache.keyOf(m.Date)]
	return entry, ok
}

func (cache *MomentCache) set(m *shelf.Moment, entry *MomentCacheItem) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	cache.entries[cache.keyOf(m.Date)] = entry
}

func (cache *MomentCache) Fetch(m *shelf.Moment) *MomentCacheItem {
	if cached, ok := cache.lookup(m); ok {
		return cached
	}
	cached := cache.compile(m)
	cache.set(m, cached)
	return cached
}

func (cache *MomentCache) Preview(m *shelf.Moment) *MomentCacheItem {
	return cache.compile(m)
}

func (cache *MomentCache) keyOf(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

func (cache *MomentCache) Save(origTime time.Time, m *shelf.Moment) error {
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

func (cache *MomentCache) compile(m *shelf.Moment) *MomentCacheItem {
	const EmptyEntityIDMessage = `<strong class="error">No entity field</strong>`
	const EmptyURLMessage = `<strong class="error">No url field</strong>`

	embeds := make([]shelf.Entity, 0)
	uta, err := fml.NewParser().Parse(m.Text)
	if err != nil {
		return &MomentCacheItem{
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
			md, err := fetchMarkdown(ren.URL)
			if err != nil {
				buff.WriteString(fmt.Sprintf(`<p><strong class="error">Failed to embed markdown(%s): %v</strong></p>`, ren.URL, err))
			} else {
				buff.WriteString(md)
			}
		}
	}

	body := buff.String()

	return &MomentCacheItem{
		Moment: m,
		body:   body,
		embeds: embeds,
	}

}
