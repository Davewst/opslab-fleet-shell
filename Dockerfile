# No nginx config, no fonts, no design tokens. Those live in the base.
ARG BASE_IMAGE=ghcr.io/Davewst/opslab-base:latest
FROM ${BASE_IMAGE}

ARG VERSION=0.0.0-dev
ARG COMMIT=local
ARG APP=app
LABEL org.opencontainers.image.title="opslab-${APP}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}"

COPY --chown=101:101 site/ /usr/share/nginx/html/
USER 101
