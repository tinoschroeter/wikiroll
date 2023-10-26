addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

const createUrl = (pageNumber, all, lang) => {
  let now;

  if (all) {
    now = new Date("2023-04-24T13:37:00.000Z");
  } else {
    now = new Date();
  }
  const days = 24 * 60 * 60 * 1000 * pageNumber;
  const date = new Date(now.getTime() - days);

  const currentYear = date.getFullYear().toString();
  const currentMonth = (date.getMonth() + 1).toString().padStart(2, "0");
  const currentDay = date.getDate().toString().padStart(2, "0");

  return {
    url: `https://${lang}.wikipedia.org/api/rest_v1/feed/featured/${currentYear}/${currentMonth}/${currentDay}`,
    year: currentYear,
    month: currentMonth,
    day: currentDay,
  };
};

const massageDataToFitTheApp = (data) => {
  const array = data.mostread.articles.filter((item) => item.originalimage);
  const result = array.map((item) => {
    const obj = {};
    obj.title = item.normalizedtitle;
    obj.image = item.originalimage.source;
    obj.thumbnail = item.thumbnail.source.replace(/\d+px/g, "400px");
    obj.description = item.description;
    obj.date = item.view_history.reverse()[0].date;
    obj.url = item.content_urls.desktop.page;
    obj.txt = item.extract;

    return obj;
  });

  return result;
};

const handleRequest = async (request) => {
  const { pathname } = new URL(request.url);
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "https://en.wikipedia.org/api/rest_v1/#/Math",
      },
    });
  } else if (
    parts.length === 4 &&
    parts[0] === "api" &&
    parts[1] === "rest_v1"
  ) {
    const lang = parts[2];
    const page = parseInt(parts[3]);

    const { url, year, month, day } = createUrl(page, false, lang);

    const cache = await wikiroll.get(url);

    if (cache !== null) {
      return new Response(cache, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        status: 200,
      });
    }

    try {
      const response = await fetch(url);
      const data = await response.json();

      const result = massageDataToFitTheApp(data);

      if (result[0].date === `${year}-${month}-${day - 1}Z`) {
        await wikiroll.put(url, JSON.stringify(result));
      }

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        status: 200,
      });
    } catch (error) {
      console.error(error);

      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        status: 500,
      });
    }
  } else if (
    parts.length === 5 &&
    parts[0] === "api" &&
    parts[1] === "rest_v1" &&
    parts[2] === "all"
  ) {
    const lang = parts[3];
    let page = parseInt(parts[4]);

    const { url, year, month, day } = createUrl(page, true, lang);

    const cache = await wikiroll.get(url);

    if (cache !== null) {
      return new Response(cache, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        status: 200,
      });
    }
    try {
      const response = await fetch(url);
      const data = await response.json();

      const result = massageDataToFitTheApp(data);

      if (result[0].date === `${year}-${month}-${day - 1}Z`) {
        await wikiroll.put(url, JSON.stringify(result));
      }

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        status: 200,
      });
    } catch (error) {
      console.error(error);

      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        status: 500,
      });
    }
  }

  return new Response(null, {
    status: 404,
    statusText: "Not Found",
  });
};
