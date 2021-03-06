'use strict';

describe('Service: accountService ', function () {

  var $rootScope, accountService, $http, $q, settings, cloudProviderRegistry;

  beforeEach(
    window.module(
      require('./account.service')
    )
  );

  beforeEach(
    window.inject(function (_$rootScope_, _accountService_, $httpBackend, infrastructureCaches, _$q_, _settings_,
                            _cloudProviderRegistry_) {
      $rootScope = _$rootScope_;
      accountService = _accountService_;
      $http = $httpBackend;
      $q = _$q_;
      settings = _settings_;
      cloudProviderRegistry = _cloudProviderRegistry_;

      if (infrastructureCaches.credentials) {
        infrastructureCaches.credentials.removeAll();
      }
    })
  );

  it('should filter the list of accounts by provider when supplied', function () {
    $http.expectGET('/credentials').respond(200, [
      {name: 'test', type: 'aws'},
      {name: 'prod', type: 'aws'},
      {name: 'prod', type: 'gce'},
      {name: 'gce-test', type: 'gce'},
    ]);

    var accounts = null;
    accountService.listAccounts('aws').then(function (results) {
      accounts = results;
    });

    $http.flush();

    expect(accounts.length).toBe(2);
    expect(_.pluck(accounts, 'name')).toEqual(['test', 'prod']);
  });

  describe('get Availability Zones For Account And Region', function () {


    it('should return intersection of preferred and actual AZ when: actual count > preferred count', function () {

      var accountName = 'prod';
      var regionName = 'us-east-1';

      settings.providers.aws.preferredZonesByAccount = {
        prod: {
          'us-east-1': ['us-east-1c', 'us-east-1d', 'us-east-1e'],
        }
      };

      $http.whenGET('/credentials/' + accountName).respond(200,
        {
          regions: [
            {
              name: regionName,
              availabilityZones: [
                'us-east-1a',
                'us-east-1b',
                'us-east-1c',
                'us-east-1d',
                'us-east-1e',
              ]
            },
          ]
        }
      );

      var test = function (result) {
        expect(result).toEqual(['us-east-1c', 'us-east-1d', 'us-east-1e']);
      };

      accountService.getAvailabilityZonesForAccountAndRegion('aws', accountName, regionName).then(test);

      $http.flush();
    });


    it('should return intersection of preferred and actual AZ when: actual count < preferred count', function () {

      var accountName = 'prod';
      var regionName = 'us-east-1';

      settings.providers.aws.preferredZonesByAccount = {
        prod: {
          'us-east-1': ['us-east-1a', 'us-east-1b', 'us-east-1c'],
        }
      };

      $http.whenGET('/credentials/' + accountName).respond(200,
        {
          regions: [
            {
              name: regionName,
              availabilityZones: [
                'us-east-1a',
              ]
            },
          ]
        }
      );

      var test = function (result) {
        expect(result).toEqual(['us-east-1a']);
      };

      accountService.getAvailabilityZonesForAccountAndRegion('aws', accountName, regionName).then(test);

      $http.flush();
    });

    it('should return intersection of preferred and actual AZ when: actual count === preferred count', function () {

      var accountName = 'prod';
      var regionName = 'us-east-1';

      settings.providers.aws.preferredZonesByAccount = {
        prod: {
          'us-east-1': ['us-east-1a', 'us-east-1b', 'us-east-1c'],
        }
      };

      $http.whenGET('/credentials/' + accountName).respond(200,
        {
          regions: [
            {
              name: regionName,
              availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c']
            },
          ]
        }
      );

      var test = function (result) {
        expect(result).toEqual(['us-east-1a', 'us-east-1b', 'us-east-1c']);
      };

      accountService.getAvailabilityZonesForAccountAndRegion('aws', accountName, regionName).then(test);

      $http.flush();
    });

    it('should return an empty list when there is no intersection', function () {

      var accountName = 'prod';
      var regionName = 'us-east-1';

      settings.providers.aws.preferredZonesByAccount = {
        prod: {
          'us-east-1': ['us-east-1a'],
        }
      };

      $http.whenGET('/credentials/' + accountName).respond(200,
        {
          regions: [
            {
              name: regionName,
              availabilityZones: ['us-east-1d', 'us-east-1e']
            },
          ]
        }
      );

      var test = function (result) {
        expect(result).toEqual([]);
      };

      accountService.getAvailabilityZonesForAccountAndRegion('aws', accountName, regionName).then(test);

      $http.flush();
    });


    it('should return the default AZ if the credential fetch fails for an account', function () {

      var accountName = 'prod';
      var regionName = 'us-east-1';

      settings.providers.aws.preferredZonesByAccount = {
        prod: {
          'us-east-1': ['us-east-1b'],
        },
        default: {
          'us-east-1': ['us-east-1a'],
        }
      };

      $http.whenGET('/credentials/' + accountName).respond(500);

      var test = function (result) {
        expect(result).toEqual(settings.providers.aws.preferredZonesByAccount.default[regionName]);
      };

      accountService.getAvailabilityZonesForAccountAndRegion('aws', accountName, regionName).then(test);

      $http.flush();
    });

  });

  describe('listProviders', function () {

    beforeEach(function() {
      this.registeredProviders = ['aws', 'gce', 'cf'];
      $http.whenGET('/credentials').respond(200,
        [ { type: 'aws' }, { type: 'gce' }, { type: 'cf' }]
      );

      spyOn(cloudProviderRegistry, 'listRegisteredProviders').and.returnValue(this.registeredProviders);
    });

    it('should list all providers when no application provided', function () {

      let test = (result) => expect(result).toEqual(['aws', 'gce', 'cf']);

      accountService.listProviders().then(test);

      $http.flush();
    });

    it('should filter out providers not registered', function () {
      this.registeredProviders.pop();

      let test = (result) => expect(result).toEqual(['aws', 'gce']);

      accountService.listProviders().then(test);

      $http.flush();
    });

    it('should fall back to the defaultProviders if none configured for the application', function () {
      let application = { attributes: {} };

      let test = (result) => expect(result).toEqual(['gce', 'cf']);

      settings.defaultProviders = ['gce', 'cf'];

      accountService.listProviders(application).then(test);

      $http.flush();
    });

    it('should return the intersection of those configured for the application and those available from the server', function () {
      let application = { attributes: { cloudProviders: 'gce,cf,unicron' } };

      let test = (result) => expect(result).toEqual(['gce', 'cf']);

      settings.defaultProviders = ['aws'];

      accountService.listProviders(application).then(test);

      $http.flush();
    });

    it('should return an empty array if none of the app providers are available from the server', function () {
      let application = { attributes: { cloudProviders: 'lamp,ceiling fan' } };

      let test = (result) => expect(result).toEqual([]);

      settings.defaultProviders = 'aws';

      accountService.listProviders(application).then(test);

      $http.flush();
    });

    it('should fall back to all registered available providers if no defaults configured and none configured on app', function () {
      let application = { attributes: {} };

      let test = (result) => expect(result).toEqual(['aws', 'gce', 'cf']);

      delete settings.defaultProviders;

      accountService.listProviders(application).then(test);

      $http.flush();
    });

  });
});


