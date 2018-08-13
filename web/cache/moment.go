package cache

import (
	"fmt"
	"regexp"
	"sync"

	"strings"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
)

type MomentCacheShelf struct {
	shelf   *shelf.Shelf
	mutex   sync.Mutex
	entries map[*shelf.Moment]*MomentCache
}

func NewMomentCacheShelf(sh *shelf.Shelf) *MomentCacheShelf {
	return &MomentCacheShelf{
		shelf:   sh,
		entries: make(map[*shelf.Moment]*MomentCache),
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

var (
	embedRegex     = regexp.MustCompile(`\[(link|image|video|audio) ([^\]]+)\]`)
	paragraphRegex = regexp.MustCompile(`((\r?\n){2})`)
	blockRegex     = regexp.MustCompile(`<(script|div|pre|hr|ol|ul|video|blockquote|canvas) `)
	keyValueRegex  = regexp.MustCompile(`([a-z]+)="([^"]*)"`)
)

func parseEmbedFields(str string) map[string]string {
	kv := make(map[string]string)
	for _, matches := range keyValueRegex.FindAllStringSubmatch(str, -1) {
		kv[matches[1]] = matches[2]
	}
	return kv
}

func (cache *MomentCacheShelf) lookup(m *shelf.Moment) (*MomentCache, bool) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	entry, ok := cache.entries[m]
	return entry, ok
}

func (cache *MomentCacheShelf) set(m *shelf.Moment, entry *MomentCache) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	cache.entries[m] = entry
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

func (cache *MomentCacheShelf) compile(m *shelf.Moment) *MomentCache {
	embeds := make([]shelf.Entity, 0)

	paragraphs := paragraphRegex.Split(m.Text, -1)

	for i, paragraph := range paragraphs {
		if embedRegex.MatchString(paragraph) || blockRegex.MatchString(paragraph) {
			continue
		}
		paragraphs[i] = fmt.Sprintf("<p>%s</p>", paragraph)
	}
	body := strings.Join(paragraphs, "\n")
	body = embedRegex.ReplaceAllStringFunc(body, func(embed string) string {
		matches := embedRegex.FindStringSubmatch(embed)
		fileType := matches[1]
		fields := parseEmbedFields(matches[2])
		id, ok := fields["entity"]
		if !ok {
			return fmt.Sprintf(`<strong class="error">No entity field</strong>`)
		}
		e := cache.shelf.LookupEntity(id)
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
			if img, ok := e.(*shelf.ImageEntity); ok {
				embeds = append(embeds, e)
				url := fmt.Sprintf("/entity/%s", id)
				src := fmt.Sprintf("/entity/%s/medium", id)
				if v, ok := fields["to"]; ok {
					url = v
				}
				w, h := calcImageSizeWithMinLength(uint(img.Width), uint(img.Height), MediumSize)
				return fmt.Sprintf(`<a href="%s"><img src="%s" class="embed" width="%d" height="%d"></a>`, url, src, w, h)
			} else {
				return fmt.Sprintf(`<strong class="error">Entity(%s) is not image.</strong>`, id)
			}
		case "video":
			if video, ok := e.(*shelf.VideoEntity); ok {
				embeds = append(embeds, e)
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
	return &MomentCache{
		Moment: m,
		body:   body,
		embeds: embeds,
	}

}
