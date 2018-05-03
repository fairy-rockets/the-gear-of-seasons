package web

import (
	"fmt"
	"regexp"
	"sync"

	"github.com/FairyRockets/the-gear-of-seasons/entity"
	"github.com/FairyRockets/the-gear-of-seasons/moment"
)

type momentCache struct {
	momentStore *moment.Store
	entityStore *entity.Store
	mutex       sync.Mutex
	entries     map[*moment.Moment]*momentCacheEntry
}

func newMomentCache(entities *entity.Store, moments *moment.Store) *momentCache {
	return &momentCache{
		momentStore: moments,
		entityStore: entities,
		entries:     make(map[*moment.Moment]*momentCacheEntry),
	}
}

type momentCacheEntry struct {
	body      string
	embedding []entity.Entity
}

var (
	embedRegex     = regexp.MustCompile(`\[(link|image|video|audio) ([^\]]+)\]`)
	paragraphRegex = regexp.MustCompile(`(?ms)(^|\n+|>\n)(.+?)($|\n\n+|\n<)`)
	blockRegex     = regexp.MustCompile(`<(script|div|pre|hr|ol|ul|video|blockquote|canvas) `)
	keyValueRegex  = regexp.MustCompile(`([a-z]+)="([^"]*)"`)
)

func parseEmbedFiels(str string) map[string]string {
	kv := make(map[string]string)
	for _, matches := range keyValueRegex.FindAllStringSubmatch(str, -1) {
		kv[matches[1]] = matches[2]
	}
	return kv
}
func (cache *momentCache) lookup(m *moment.Moment) (*momentCacheEntry, bool) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	entry, ok := cache.entries[m]
	return entry, ok
}

func (cache *momentCache) set(m *moment.Moment, entry *momentCacheEntry) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	cache.entries[m] = entry
}

func (cache *momentCache) Fetch(m *moment.Moment) (string, []entity.Entity) {
	if entry, ok := cache.lookup(m); ok {
		return entry.body, entry.embedding
	}
	entry := cache.compile(m)
	cache.set(m, entry)
	return entry.body, entry.embedding
}

func (cache *momentCache) compile(m *moment.Moment) *momentCacheEntry {
	c := &momentCacheEntry{}
	body := m.Text

	body = paragraphRegex.ReplaceAllStringFunc(body, func(match string) string {
		matches := paragraphRegex.FindStringSubmatch(match)
		if embedRegex.MatchString(matches[2]) || blockRegex.MatchString(matches[2]) {
			return match
		} else {
			return fmt.Sprintf("%s<p>%s</p>%s", matches[1], matches[2], matches[3])
		}
	})
	body = embedRegex.ReplaceAllStringFunc(body, func(embed string) string {
		matches := embedRegex.FindStringSubmatch(embed)
		fileType := matches[1]
		fields := parseEmbedFiels(matches[2])
		id, ok := fields["entity"]
		if !ok {
			return fmt.Sprintf(`<strong class="error">No entity field</strong>`)
		}
		e := cache.entityStore.Lookup(id)
		if e == nil {
			return fmt.Sprintf(`<strong class="error">Entity(%s) not found</strong>`, id)
		}
		switch fileType {
		case "link":
			url := fmt.Sprintf("/entity/%s", id)
			text := url
			if v, ok := fields["text"]; ok {
				text = v
			}
			return fmt.Sprintf(`<a href="%s">%s</a>`, url, text)
		case "image":
			if img, ok := e.(*entity.ImageEntity); ok {
				c.embedding = append(c.embedding, e)
				src := fmt.Sprintf("/entity/%s", id)
				url := src
				if v, ok := fields["to"]; ok {
					url = v
				}
				return fmt.Sprintf(`<a href="%s"><img src="%s" width="%d" height="%d"></a>`, url, src, img.Width, img.Height)
			} else {
				return fmt.Sprintf(`<strong class="error">Entity(%s) is not image.</strong>`, id)
			}
		case "video":
			if video, ok := e.(*entity.VideoEntity); ok {
				c.embedding = append(c.embedding, e)
				url := fmt.Sprintf("/entity/%s", id)
				return fmt.Sprintf(`<video  width="%d" height="%d" preload="metadata" controls="controls"><source type="%s" src="%s" /><a href="%s">Click to play.</a></video>`, video.Width, video.Height, video.MimeType, url, url)
			} else {
				return fmt.Sprintf(`<strong class="error">Entity(%s) is not video.</strong>`, id)
			}
		case "audio":
			return fmt.Sprintf(`<strong class="error">%s not supported</strong>`, fileType)
		default:
			return fmt.Sprintf(`<strong class="error">%s not supported</strong>`, fileType)
		}
	})
	c.body = fmt.Sprintf(`
<div class="moment-info">
	<h1 class="moment-title">%s</h1>
	<span class="moment-date">%s</span>
	<span class="moment-author">%s</span>
</div>
<hr>
%s`, m.Title, m.DateString(), m.Author, body)
	return c
}
