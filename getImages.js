'use strict';
require('dotenv').config();

var casper = require('casper').create({
	pageSettings: {
		webSecurityEnabled: false
	}
});
var fs = require('fs');
var validUrl = require('valid-url');
var _urls = require('./urls');
const GitHub = require('octocat');

var token, urls = [],
	images = [],
	client, BASE_URL = 'https://mult18.cyclic.app/';

for (var _url of Object.keys(_urls)) {
	for (var url of _url) {
		url = url.split('/')[1].toLowerCase();
		url = url.replace(/_/g, "");
		url = BASE_URL + url.replace(/-/g, "");
		urls.push(url);
	};
};


if (casper.cli.has(0) || process.env.TOKEN) {
	token = casper.cli.get(0) || process.env.TOKEN;
	if(!token.startsWith('ghp_')) casper.echo("Invalid token!").exit();
	// Using an access token
	client = new GitHub({
		token
	});
} else {
	casper.echo("No, git token provided").exit();
}


const org = client.org('devkhub-images' || process.env.ORG);


for (var sourcePage of urls) {
	var REPO_NAME = (casper.cli.get(1) || "") + sourcePage.split(BASE_URL);
	org.createRepo({
		name: REPO_NAME,
		"private": false
	}).then(function() {
		casper.echo(REPO_NAME + "created!")
	}).catch(() => {
		casper.echo(REPO_NAME + "unable to create!")
	});


	function getAllTheImagesTag() {
		var els = document.querySelectorAll('img');
		var results = [];
		var uniqueLinks = [];

		Array.prototype.forEach.call(els, function(el) {
			var isPng = new RegExp('png$', 'i');
			var isJpg = new RegExp('jpg$', 'i');
			var isJpeg = new RegExp('jpeg$', 'i');
			var isGif = new RegExp('gif$', 'i');
			var isSvg = new RegExp('svg$', 'i');

			if (el.hasAttribute('src') || el.hasAttribute('data-src') || el.hasAttribute('file')) {
				var imgUrl = el.getAttribute('src') == null ? el.getAttribute('data-src').split('?')[0] : el.getAttribute('src').split('?')[0];

				imgUrl = imgUrl == null ? el.getAttribute('file').split('?')[0] : imgUrl;
				imgUrl = imgUrl.indexOf('//') == 0 ? 'http:' + imgUrl : imgUrl;
				imgUrl = imgUrl.trim();
				if (isPng.test(imgUrl) || isJpg.test(imgUrl) || isJpeg.test(imgUrl) || isGif.test(imgUrl) || isSvg.test(imgUrl)) {
					if (uniqueLinks.indexOf(imgUrl) == -1) {
						uniqueLinks.push(imgUrl);
						results.push({
							url: imgUrl
						});
					}
				}
			}
		});

		return results;
	}

	function outputDownloadProgress(index, numberOfImages, imgName) {
		console.log("Downloading " + index + " out of " + numberOfImages + " image(s).");
		console.log("\t" + imgName);
	}

	function downloadTheImage(casper, imgUrl, folderPath, imgName) {
		var pathToImage = folderPath + imgName;

		if (fs.exists(pathToImage)) {
			pathToImage = folderPath + Math.random().toString(36).substring(7) + imgName;
			casper.download(imgUrl, pathToImage);
		} else {
			pathToImage = folderPath + imgName;
			casper.download(imgUrl, pathToImage);
		}
	}

	casper.start(sourcePage);

	casper.on('load.failed', function(status) {
		this.echo(status.url + " failed to load, aborting... ").exit();
	});

	casper.then(function(res) {
		images = this.evaluate(getAllTheImagesTag);

		var count = 0;
		var numberOfImages = images.length;
		sourcePage = res.url.split('?')[0];

		this.echo("Begin to download all the images...");
		this.echo("There are in total of " + numberOfImages + " image(s).");
		images.forEach(function(currentValue, index, arr) {
			var folderPath = REPO_NAME;
			var imgUrl = currentValue.url;
			var splittedImageUrl = imgUrl.split('/');
			var imgName = /* splittedImageUrl[splittedImageUrl.length - 1]; */ (index + 1);
			var pathToImage = folderPath + imgName;

			downloadTheImage(casper, imgUrl, folderPath, imgName);
			if (fs.isFile(pathToImage) && fs.size(pathToImage) == 0) {
				fs.remove(pathToImage);
				casper.thenOpen(imgUrl, function(resourse) {
					downloadTheImage(casper, resourse.url, folderPath, imgName);
					outputDownloadProgress(++count, numberOfImages, imgName);
				});
			} else {
				outputDownloadProgress(++count, numberOfImages, imgName);
			}
		});
	});

	casper.run(function() {
		console.log("Finished downloading " + images.length + " image(s).");
		console.log("Exiting now...");
		this.exit();
	});
};
