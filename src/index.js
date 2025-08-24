addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

const createUrl = (pageNumber, all, lang) => {
  const now = all ? new Date("2023-04-24T13:37:00.000Z") : new Date();
  const days = 24 * 60 * 60 * 1000 * pageNumber;
  const date = new Date(now.getTime() - days);

  const currentYear = date.getFullYear().toString();
  const currentMonth = (date.getMonth() + 1).toString().padStart(2, "0");
  const currentDay = date.getDate().toString().padStart(2, "0");

  const url = `https://${lang}.wikipedia.org/api/rest_v1/feed/featured/${currentYear}/${currentMonth}/${currentDay}`;

  return { url, year: currentYear, month: currentMonth, day: currentDay };
};

const parseResponseData = async (response) => {
  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  } else {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Response is not valid JSON. Content-Type: ${contentType}, Content: ${text.substring(0, 200)}...`,
      );
    }
  }
};

const massageDataToFitTheApp = (data) => {
  return data.mostread.articles
    .filter((item) => item.originalimage)
    .map((item) => ({
      title: item.normalizedtitle,
      image: item.originalimage.source,
      thumbnail: item.thumbnail.source.replace(/\d+px/g, "650px"),
      description: item.description,
      date: item.view_history[item.view_history.length - 1].date,
      url: item.content_urls.desktop.page,
      txt: item.extract,
    }));
};

const handleRequest = async (request) => {
  const { pathname } = new URL(request.url);
  const parts = pathname.split("/").filter(Boolean);

  const headers = {
    headers: {
      "User-Agent": "wikiroll/1.0 (tino.schroeter@gmail.com)",
    },
  };

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
      const response = await fetch(url, headers);
      const data = await parseResponseData(response);

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
      const response = await fetch(url, headers);
      const data = await parseResponseData(response);

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
