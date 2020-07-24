#! /bin/bash

REV=$(git log -1 --date=iso --pretty=format:"[%ad] %h %an : %s")
REV=${REV//\\/\\\\}
REV=${REV//\"/\\\"}

cat > "${GOFILE%.go}".gen.go <<END
package ${GOPACKAGE}

import (
	"strings"
)

func buildAt() string {
	return "$(date "+%Y-%m-%d %H:%M:%S %z")"
}

func gitRev() string {
	rev := "${REV}"
	if len(rev) == 0 {
		return "<not available>"
	}
	return strings.TrimSpace(rev)
}

END