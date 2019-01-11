function ViewModel()
{
    var self = this;

    var _millisecond = 1;
    var _second = _millisecond * 1000;
    var _minute = _second * 60;
    var _hour = _minute * 60;
    var _day = _hour * 24;

    self.updateFrequency = 500 * _millisecond;
    self.roundLengthSeconds = 10 * _minute;
    self.warningThreshold = 10 * _second;
    self.timerId = '';
    self.timeRemainingText = ko.observable();

    self.startDateTime = new Date();
    self.endDateTime = new Date();
    self.initialDiff = self.endDateTime - self.startDateTime;
    self.pauseDateTime = new Date();
    self.timerRunning = false;
    self.currentBlindIndex = ko.observable(0);
    self.blinds = ko.observableArray([]);
    self.currentBlindText = ko.computed(function () {
        if (self.blinds().length === 0 || self.currentBlindIndex() >= self.blinds().length)
            return '??? / ???';
        var selectedBlind = self.blinds()[self.currentBlindIndex()];
        return selectedBlind.text;

    }, self);
    
    self.currentBlindData = ko.computed(function(){
        if (self.blinds().length === 0 || self.currentBlindIndex() >= self.blinds().length)
            return {
                        text: '??? / ???',
                        id: 'blind' + self.currentBlindIndex(),
                        roundLengthSeconds: 60 * _minute
                    };
        return self.blinds()[self.currentBlindIndex()];
    });

    self.buyinTimeSECS = 0;
    self.buyinEndTime = new Date();
    self.buyinInitialDiff = 0;
    self.buyinTimeRemainingText = ko.observable('00:00');

    self.notifySound = ko.observable();
    self.buyinWarning = ko.observable();
    self.chips = ko.observableArray([]);

    self._formatText = function (value)
    {
        if (value > 9)
            return value;

        return '0' + value;
    };

    self.ResetTimer = function ()
    {
        self.startDateTime = new Date();
        self.endDateTime = new Date(self.startDateTime.getTime() + self.currentBlindData().roundLengthSeconds);
        self.initialDiff = self.endDateTime - self.startDateTime;
    };

    self.UpdateProgress = function (id, value, max)
    {
        var percent = (value / max) * 100;
        var progress = document.getElementById(id);
        // Get the length of the circumference of the circle
        var circumference = progress.r.baseVal.value * 2 * Math.PI;
        // How long our stroke dash has to be to cover <percent> of the circumference?
        var dashLength = percent * circumference / 100;
        // Set the "stroke-dasharray" property of the cicle
        progress.style.strokeDasharray = dashLength + ' ' + circumference;
    };

    self.FormatDiff = function (diff)
    {
        var result = '';
        var days = Math.floor(diff / _day);
        if (days > 0)
            result += days + '.';

        var hours = Math.floor((diff % _day) / _hour);
        if (days > 0 || hours > 0)
            result += self._formatText(hours) + ':';

        var minutes = Math.floor((diff % _hour) / _minute);
        result += self._formatText(minutes) + ':';
        var seconds = Math.floor((diff % _minute) / _second);
        result += self._formatText(seconds);

        return result;
    };

    self.SetColors = function (id, stroke, fill)
    {
        var element = document.getElementById(id);
        element.style.stroke = stroke;
        element.style.fill = fill;
    };
    
    self.UpdateColors = function(id, warning)
    {
        if (!self.Running())
        {
            self.SetColors(id, '#FFAE42', '#FFAE42');
        } else
        {
            if (warning)
            {
                self.SetColors(id, '#F00', '#F00');
            } else
            {
                self.SetColors(id, '#0F0', '#CCC');
            }
        }
    };

    self.OnUpdate = function ()
    {
        var now = new Date();
        var diff = self.endDateTime - now;

        if (self.Running() && diff < 0)
        {
            self.PlaySound('notifySound');
            self.OnNextBlind();
            diff = 0;
        }
        
        self.timeRemainingText(self.FormatDiff(diff));
        self.UpdateProgress("progress", diff, self.initialDiff);
        self.UpdateColors("progress", (diff <= self.warningThreshold));        

        var buyindiff = self.buyinEndTime - now;
        if (self.Running() && (buyindiff <= self.buyinWarningThreshold) && (buyindiff + (self.updateFrequency * 1.2) >= self.buyinWarningThreshold))
        {
            self.PlaySound('buyinWarning');
        }
        
        if (buyindiff > -2500 && buyindiff < 0)
        {
            $('#buyinTimeContainer').hide();
        } else if(buyindiff > 0)
        {
            self.buyinTimeRemainingText(self.FormatDiff(buyindiff));
            self.UpdateProgress("buyinProgress", buyindiff, self.buyinInitialDiff);
            self.UpdateColors("buyinProgress", (buyindiff <= self.buyinWarningThreshold));
        }
    };

    self.OnAddMinute = function ()
    {
        self.endDateTime = new Date(self.endDateTime.getTime() + _minute);
        if (!self.Running())
            self.OnUpdate();
    };

    self.OnSubMinute = function ()
    {
        self.endDateTime = new Date(self.endDateTime.getTime() - _minute);
        if (!self.Running())
            self.OnUpdate();
    };

    self.AdjustBlinds = function (change)
    {
        var currentBlindData = self.currentBlindData();
        $('#' + currentBlindData.id).removeClass("currentListedBlind");
        self.currentBlindIndex(self.currentBlindIndex() + change);
        currentBlindData = self.currentBlindData();
        $('#' + currentBlindData.id).addClass("currentListedBlind");
        self.ResetTimer();
        if (!self.Running())
            self.OnUpdate();
    };

    self.OnLastBlind = function ()
    {
        if (self.currentBlindIndex() <= 0)
            return;

        self.AdjustBlinds(-1);
    };

    self.OnNextBlind = function ()
    {
        if (self.currentBlindIndex() >= self.blinds().length)
            return;

        self.AdjustBlinds(1);
    };

    self.OnPlayPauseClick = function ()
    {
        if (self.Running())
            self.StopTimer();
        else
            self.StartTimer();
    };

    self.StartTimer = function ()
    {
        var now = new Date();
        var diff = now - self.pauseDateTime;
        self.endDateTime = new Date(self.endDateTime.getTime() + diff);
        self.startDateTime = new Date(self.startDateTime.getTime() + diff);

        self.buyinEndTime = new Date(self.buyinEndTime.getTime() + diff);

        self.timerRunning = true;

        $('#play-icon').hide();
        $('#pause-icon').show();
        self.timerId = window.setInterval(function () {
            self.OnUpdate();
        }, self.updateFrequency);
    };

    self.StopTimer = function ()
    {
        self.timerRunning = false;
        $('#play-icon').show();
        $('#pause-icon').hide();
        self.pauseDateTime = new Date();
        window.clearInterval(self.timerId);
        self.timerId = '';
        self.OnUpdate();
    };

    self.Running = function ()
    {
        return self.timerRunning;
    };

    self.PlaySound = function (id)
    {
        document.getElementById(id).play();
    };

    self.Init = function ()
    {
        ko.applyBindings(self);
        $.ajax({
            type: 'GET',
            url: 'settings.json',
            dataType: 'json',
            success: function (data) {
                self.notifySound(data.notifySound);
                self.buyinWarning(data.buyinWarning);
                var blindObjects = [];

                for (var index = 0, len = data.blinds.length; index < len; index++)
                {
                    var blindItem = data.blinds[index];
                    blindObjects.push({
                        text: blindItem.text,
                        id: 'blind' + index,
                        roundLengthSeconds: blindItem.roundLengthMINS * _minute
                    });
                }

                self.blinds(blindObjects);

                self.chips(data.chips);
                self.updateFrequency = data.updateFrequencyMS * _millisecond;
                //self.roundLengthSeconds = data.roundLengthMINS * _minute;
                self.warningThreshold = data.warningThresholdSECS * _second;
                self.buyinWarningThreshold = data.buyinWarningThresholdSECS * _second;
                var now = new Date();
                self.buyinEndTime = new Date(now.getTime() + data.buyinTimeSECS * _second);
                self.buyinInitialDiff = self.buyinEndTime - now;
                self.AdjustBlinds(0);
            }
        });
        $('#play-icon').show();
        $('#pause-icon').hide();
    };
}

var noSleep = new NoSleep();

document.addEventListener('click', function enableNoSleep() {
  document.removeEventListener('click', enableNoSleep, false);
  noSleep.enable();
  //noSleep.disable();
}, false);

var vm = new ViewModel();
vm.Init();

