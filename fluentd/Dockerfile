FROM fluentd:v1.16-1

# Use root account to use apk
USER root

# Install plugins
RUN apk add --no-cache --update --virtual .build-deps \
        sudo build-base ruby-dev \
 && sudo gem install fluent-plugin-elasticsearch \
 && sudo gem install fluent-plugin-mongo \
 && sudo gem install fluent-plugin-rewrite-tag-filter \
 && sudo gem install fluent-plugin-route \
 && apk del .build-deps \
 && rm -rf /var/cache/apk/* \
 && rm -rf /tmp/* /var/tmp/* /usr/lib/ruby/gems/*/cache/*.gem

# Copy configuration files
COPY conf/fluent.conf /fluentd/etc/
COPY entrypoint.sh /bin/

USER fluent
