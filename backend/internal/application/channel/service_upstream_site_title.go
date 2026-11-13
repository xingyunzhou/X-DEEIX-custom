package channel

import (
	"context"
	"errors"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/DEEIX-AI/DEEIX-Chat/backend/internal/shared/security"
)

const (
	siteTitleRequestTimeout = 5 * time.Second
	siteTitleMaxHTMLBytes   = 256 * 1024
	siteTitleRequestUA      = "Mozilla/5.0 (compatible; DEEIX-Chat/1.0; +https://github.com/DEEIX-AI/DEEIX-Chat)"
)

var siteTitlePattern = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)

// UpstreamSiteTitleView 是上游站点标题解析结果；Title 为空时使用 Host 回填。
type UpstreamSiteTitleView struct {
	Title string
	Host  string
}

// ResolveUpstreamSiteTitle 尽力获取接口站点根页面的 <title>，失败时回退为接口主域。
func (s *Service) ResolveUpstreamSiteTitle(ctx context.Context, rawURL string) (UpstreamSiteTitleView, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed == nil || parsed.Host == "" {
		return UpstreamSiteTitleView{}, ErrInvalidBaseURL
	}
	host := strings.TrimSpace(parsed.Hostname())
	origin, err := security.HTTPOrigin(parsed.String())
	if err != nil {
		return UpstreamSiteTitleView{}, err
	}
	result := UpstreamSiteTitleView{Host: host}

	policy, err := s.outboundPolicy.WithTrustedHTTPURLs(origin)
	if err != nil {
		return result, nil
	}
	client := security.NewOutboundHTTPClient(policy, siteTitleRequestTimeout)
	client.CheckRedirect = func(request *http.Request, via []*http.Request) error {
		if len(via) >= 3 {
			return errors.New("too many redirects")
		}
		redirectOrigin, originErr := security.HTTPOrigin(request.URL.String())
		if originErr != nil {
			return originErr
		}
		if redirectOrigin == origin {
			return nil
		}
		return security.ValidateOutboundHTTPURL(request.URL.String(), policy)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, origin, nil)
	if err != nil {
		return result, nil
	}
	request.Header.Set("Accept", "text/html,application/xhtml+xml")
	request.Header.Set("User-Agent", siteTitleRequestUA)

	response, err := client.Do(request)
	if err != nil {
		return result, nil
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 400 {
		return result, nil
	}
	contentType := strings.ToLower(response.Header.Get("Content-Type"))
	if contentType != "" && !strings.Contains(contentType, "text/html") && !strings.Contains(contentType, "application/xhtml") {
		return result, nil
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, siteTitleMaxHTMLBytes))
	if err != nil || !utf8.Valid(body) {
		return result, nil
	}
	match := siteTitlePattern.FindSubmatch(body)
	if len(match) < 2 {
		return result, nil
	}
	title := strings.Join(strings.Fields(html.UnescapeString(string(match[1]))), " ")
	if title == "" {
		return result, nil
	}
	result.Title = truncateRunes(title, 120)
	return result, nil
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return strings.TrimSpace(string(runes[:limit]))
}
