# composer
FROM composer:latest as vendor

COPY composer.json composer.lock ./
COPY database/ database/

RUN composer install \
    --ignore-platform-reqs \
    --no-interaction \
    --no-plugins \
    --no-scripts \
    --prefer-dist

# build css & js
FROM node:current-alpine as frontend

RUN mkdir -p ./public/css ./public/js

COPY package.json package-lock.json webpack.mix.js ./
COPY resources/ resources/

RUN npm install --production && npm run prod

# php
FROM php:7-fpm-alpine

COPY . /var/www/html
COPY --from=vendor /app/vendor/ /var/www/html/vendor/
COPY --from=frontend /public/js/ /var/www/html/public/js/
COPY --from=frontend /public/css/ /var/www/html/public/css/
COPY --from=frontend /public/mix-manifest.json /var/www/html/public/mix-manifest.json

# change uid and gid for www-data user (alpine)
RUN apk --no-cache add shadow && \
    usermod -u 1000 www-data && \
    groupmod -g 1000 www-data

WORKDIR /var/www/html

RUN chgrp -R www-data /var/www/html/storage /var/www/html/bootstrap/cache && chmod -R ug+rwx /var/www/html/storage /var/www/html/bootstrap/cache
