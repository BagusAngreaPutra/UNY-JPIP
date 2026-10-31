<?php
// Journal-style URLs backed by the existing static pages and data.
$script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
$mount = rtrim(str_replace('\\', '/', dirname($script)), '/');
$root = $mount . '/';
$journal = $root . 'index.php/jpip';
$pages = [
    '' => 'index.html',
    'about' => 'about.html',
    'about/submissions' => 'submissions.html',
    'Author-guidelines' => 'author-guidelines.html',
    'about/editorialTeam' => 'editorial-team.html',
    'about/privacy' => 'privacy.html',
    'about/contact' => 'contact.html',
    'issue/current' => 'current.html',
    'issue/archive' => 'archive.html',
    'announcement' => 'announcements.html',
    'search' => 'search.html',
    'focus-and-scope' => 'focus-and-scope.html',
    'publication-ethics' => 'publication-ethics.html',
    'peer-reviewers' => 'peer-reviewers.html',
    'author-fees' => 'author-fees.html',
    'ai-policy' => 'ai-policy.html',
    'information/readers' => 'readers.html',
    'information/authors' => 'authors.html',
    'information/librarians' => 'librarians.html',
    'about/aboutThisPublishingSystem' => 'publishing-system.html',
];
$byFile = array_flip($pages);

function routeFile($slug, $pages) {
    if (isset($pages[$slug])) return $pages[$slug];
    if (preg_match('~^issue/view/(\d+)$~D', $slug, $m)) return 'issues/' . $m[1] . '.html';
    if (preg_match('~^article/view/(\d+)$~D', $slug, $m)) return 'articles/' . $m[1] . '.html';
    if (preg_match('~^article/view/(\d+)/(\d+)$~D', $slug, $m)) return 'viewers/' . $m[1] . '-' . $m[2] . '.html';
    if (preg_match('~^article/download/(\d+)/(\d+)$~D', $slug, $m)) return 'pdfs/' . $m[1] . '-' . $m[2] . '.pdf';
    return null;
}

function fileRoute($file, $byFile) {
    if (isset($byFile[$file])) return $byFile[$file];
    if (preg_match('~^issues/(\d+)\.html$~D', $file, $m)) return 'issue/view/' . $m[1];
    if (preg_match('~^articles/(\d+)\.html$~D', $file, $m)) return 'article/view/' . $m[1];
    if (preg_match('~^viewers/(\d+)-(\d+)\.html$~D', $file, $m)) return 'article/view/' . $m[1] . '/' . $m[2];
    if (preg_match('~^pdfs/(\d+)-(\d+)\.pdf$~D', $file, $m)) return 'article/download/' . $m[1] . '/' . $m[2];
    return null;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$relative = substr($path, strlen($mount) + 1);
$query = $_SERVER['QUERY_STRING'] ?? '';
$suffix = $query === '' ? '' : '?' . $query;
$oldRoute = fileRoute($relative === '' || $relative === 'index.php' ? 'index.html' : $relative, $byFile);
if ($oldRoute !== null && substr($relative, -4) !== '.pdf') {
    header('Location: ' . $journal . ($oldRoute === '' ? '' : '/' . $oldRoute) . $suffix, true, 302);
    exit;
}
$prefix = 'index.php/jpip';
$slug = $relative === $prefix ? '' : (strpos($relative, $prefix . '/') === 0 ? substr($relative, strlen($prefix) + 1) : null);
$file = $slug === null ? null : routeFile(rtrim($slug, '/'), $pages);
if ($file === null || !is_file(__DIR__ . '/' . $file)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Page not found.');
}
if (substr($file, -4) === '.pdf') {
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . basename($file) . '"');
    header('Content-Length: ' . filesize(__DIR__ . '/' . $file));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') readfile(__DIR__ . '/' . $file);
    exit;
}

$html = file_get_contents(__DIR__ . '/' . $file);
$directory = dirname($file) === '.' ? '' : dirname($file) . '/';
// Retain the source page's relative asset paths at its virtual URL.
$baseTag = '<base href="' . htmlspecialchars($root . $directory, ENT_QUOTES, 'UTF-8') . '">';
$html = preg_replace('/<head>/', '<head>' . "\n" . $baseTag, $html, 1);
$html = preg_replace_callback('~<(?:a|form)\b[^>]*>~is', function ($tag) use ($file, $directory, $mount, $journal, $pages, $byFile) {
    return preg_replace_callback('~\b(href|action)\s*=\s*([\'"])(.*?)\2~is', function ($attr) use ($file, $directory, $mount, $journal, $pages, $byFile) {
        $value = html_entity_decode($attr[3], ENT_QUOTES, 'UTF-8');
        if ($value === '') return $attr[0];
        $url = parse_url($value);
        if ($url === false) return $attr[0];
        $path = $url['path'] ?? '';
        if (isset($url['host']) || isset($url['scheme'])) {
            if (($url['host'] ?? '') !== 'journal.uny.ac.id' || !preg_match('~^/index\.php/jpip(?:/(.*))?$~D', $path, $m)) return $attr[0];
            $slug = $m[1] ?? '';
            $target = routeFile($slug, $pages);
        } else {
            $path = $path === '' ? $file : ($path[0] === '/' ? substr($path, strlen($mount) + 1) : $directory . $path);
            $parts = [];
            foreach (explode('/', $path) as $part) {
                if ($part === '..') array_pop($parts);
                elseif ($part !== '' && $part !== '.') $parts[] = $part;
            }
            $target = implode('/', $parts);
            $slug = fileRoute($target, $byFile);
        }
        if ($slug === null || $target === null || !is_file(__DIR__ . '/' . $target)) return $attr[0];
        $dest = $journal . ($slug === '' ? '' : '/' . $slug);
        if (isset($url['query'])) $dest .= '?' . $url['query'];
        if (isset($url['fragment'])) $dest .= '#' . $url['fragment'];
        return $attr[1] . '=' . $attr[2] . htmlspecialchars($dest, ENT_QUOTES, 'UTF-8') . $attr[2];
    }, $tag[0]);
}, $html);
header('Content-Type: text/html; charset=utf-8');
echo $html;
