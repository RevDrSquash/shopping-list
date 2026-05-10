FROM nginx:1.27-alpine

COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY 15-extract-resolver.envsh /docker-entrypoint.d/15-extract-resolver.envsh
RUN chmod +x /docker-entrypoint.d/15-extract-resolver.envsh
