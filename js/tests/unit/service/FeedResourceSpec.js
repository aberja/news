/**
 * ownCloud - News
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Bernhard Posselt <dev@bernhard-posselt.com>
 * @copyright Bernhard Posselt 2014
 */
describe('FeedResource', function () {
    'use strict';

    var resource,
        http;

    beforeEach(module('News', function ($provide) {
        $provide.value('BASE_URL', 'base');
    }));

    afterEach(function () {
        http.verifyNoOutstandingExpectation();
        http.verifyNoOutstandingRequest();
    });


    beforeEach(inject(function (FeedResource, $httpBackend) {
        resource = FeedResource;
        http = $httpBackend;
        FeedResource.receive([
            {id: 1, folderId: 3, url: 'ye', unreadCount: 45},
            {id: 2, folderId: 4, url: 'sye', unreadCount: 25},
            {id: 3, folderId: 3, title: 'hore', url: '1sye', unreadCount: 0}
        ]);
    }));

    it('should mark all read', inject(function (FeedResource) {

        FeedResource.markRead();

        expect(FeedResource.getUnreadCount()).toBe(0);
    }));

    it('should mark a feed read', inject(function (FeedResource) {

        FeedResource.markFeedRead(1);

        expect(FeedResource.get('ye').unreadCount).toBe(0);
    }));


    it('should mark an item read', inject(function (FeedResource) {

        FeedResource.markItemOfFeedRead(1);

        expect(FeedResource.get('ye').unreadCount).toBe(44);
    }));

    it('should mark an item unread', inject(function (FeedResource) {

        FeedResource.markItemOfFeedUnread(1);

        expect(FeedResource.get('ye').unreadCount).toBe(46);
    }));


    it('should get all of folder', inject(function (FeedResource) {

        var folders = FeedResource.getByFolderId(3);

        expect(folders.length).toBe(2);
    }));



    it('should cache unreadcount', inject(function (FeedResource) {
        expect(FeedResource.getUnreadCount()).toBe(70);

        FeedResource.markItemOfFeedRead(3);
        expect(FeedResource.getUnreadCount()).toBe(69);

        FeedResource.markItemOfFeedUnread(3);
        expect(FeedResource.getUnreadCount()).toBe(70);

        FeedResource.markFolderRead(3);
        expect(FeedResource.getUnreadCount()).toBe(25);

        FeedResource.markRead();
        expect(FeedResource.getUnreadCount()).toBe(0);
    }));


    it('should cache folder unreadcount', inject(function (FeedResource) {
        expect(FeedResource.getFolderUnreadCount(3)).toBe(45);

        FeedResource.markItemOfFeedRead(3);
        expect(FeedResource.getFolderUnreadCount(3)).toBe(44);

        FeedResource.markItemOfFeedUnread(3);
        expect(FeedResource.getFolderUnreadCount(3)).toBe(45);

        FeedResource.markFolderRead(3);
        expect(FeedResource.getFolderUnreadCount(3)).toBe(0);

        FeedResource.markRead();
        expect(FeedResource.getFolderUnreadCount(4)).toBe(undefined);
    }));


    it('should cache unreadcount', inject(function (FeedResource) {
        FeedResource.markItemsOfFeedsRead([1, 2]);
        expect(FeedResource.getUnreadCount()).toBe(68);
    }));



    it ('should delete a feed', inject(function (FeedResource) {
        http.expectDELETE('base/feeds/1').respond(200, {});

        FeedResource.delete('ye');

        http.flush();

        expect(FeedResource.size()).toBe(2);
    }));


    it ('should rename a feed', inject(function (FeedResource) {
        http.expectPOST('base/feeds/3/rename', {
            feedTitle: 'heho'
        }).respond(200, {});

        FeedResource.rename(3, 'heho');

        http.flush();
    }));


    it ('should move a feed', inject(function (FeedResource) {
        http.expectPOST('base/feeds/2/move', {
            parentFolderId: 5
        }).respond(200, {});

        FeedResource.move(2, 5);

        http.flush();

        expect(FeedResource.get('sye').folderId).toBe(5);
        expect(FeedResource.getFolderUnreadCount(5)).toBe(25);
    }));


    it ('should create a feed and prepend http if not given', inject(function (
    FeedResource) {
        http.expectPOST('base/feeds', {
            parentFolderId: 5,
            url: 'http://hey',
            title: 'abc'
        }).respond(200, {});

        FeedResource.create(' hey ', 5, ' abc');

        http.flush();

        expect(FeedResource.get('http://hey').folderId).toBe(5);
    }));


    it ('should create a feed', inject(function (FeedResource) {
        http.expectPOST('base/feeds', {
            parentFolderId: 5,
            url: 'http://hey',
            title: 'abc'
        }).respond(200, {});

        FeedResource.create('http://hey', 5, 'abc');

        http.flush();

        expect(FeedResource.get('http://hey').folderId).toBe(5);
    }));


    it ('should display a feed error', inject(function (FeedResource) {
        http.expectPOST('base/feeds', {
            parentFolderId: 5,
            url: 'https://hey',
            title: 'abc'
        }).respond(400, {message: 'noo'});

        FeedResource.create('https://hey', 5, 'abc');

        http.flush();

        expect(FeedResource.get('https://hey').error).toBe('noo');
        expect(FeedResource.get('https://hey').faviconLink).toBe('');
    }));


    it ('should create a feed with no folder', inject(function (FeedResource) {
        http.expectPOST('base/feeds', {
            parentFolderId: 0,
            url: 'http://hey',
        }).respond(200, {});

        FeedResource.create('hey', undefined);

        expect(FeedResource.get('http://hey').title).toBe('http://hey');
        http.flush();

        expect(FeedResource.get('http://hey').folderId).toBe(0);
    }));


    it ('should undo a delete folder', inject(function (FeedResource) {
        http.expectDELETE('base/feeds/1').respond(200, {});

        FeedResource.delete('ye');

        http.flush();


        http.expectPOST('base/feeds/1/restore').respond(200, {});

        FeedResource.undoDelete();

        http.flush();

        expect(FeedResource.get('ye').id).toBe(1);
    }));


});
