FROM alpine:3.20
RUN adduser -D app
COPY app.sh /usr/local/bin/app.sh
USER app
ENTRYPOINT ["/usr/local/bin/app.sh"]

