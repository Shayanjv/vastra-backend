import redis from "../../config/redis";
import environment from "../../config/environment";
import logger from "../../utils/logger.util";
import { AppError } from "../../utils/error.util";

const WEATHER_CACHE_TTL_SECONDS = 3600; // 1 hour

export interface WeatherData {
  city: string;
  temperature: number;
  feels_like: number;
  condition: string;
  humidity: number;
  description: string;
  icon: string;
  lastUpdated: string;
}

class WeatherService {
  private getCacheKey(city: string): string {
    return `weather:${city.toLowerCase().trim()}`;
  }

  /**
   * Get weather for city from OpenWeather API with Redis caching
   */
  public async getWeather(city: string): Promise<WeatherData> {
    const cacheKey = this.getCacheKey(city);

    // Check cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          logger.debug("Weather data from cache", { city });
          return parsed;
        } catch {
          logger.warn("Failed to parse cached weather data", { city });
        }
      }
    } catch (error) {
      logger.warn("Redis cache read failed for weather", {
        city,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // Fetch from OpenWeather API
    try {
      const apiKey = environment.OPENWEATHER_API_KEY;
      const baseUrl = environment.OPENWEATHER_BASE_URL;

      if (!apiKey) {
        logger.warn("OpenWeather API key not configured");
        throw new AppError("Weather service not configured", 503, "INTERNAL_500");
      }

      const url = new URL(baseUrl);
      url.searchParams.append("q", city);
      url.searchParams.append("appid", apiKey);
      url.searchParams.append("units", "metric");

      const response = await fetch(url.toString(), {
        method: "GET"
      });

      if (response.status === 404) {
        throw new AppError("City not found", 404, "INTERNAL_500");
      }

      if (!response.ok) {
        throw new AppError(
          `Weather API error: ${response.statusText}`,
          response.status,
          "INTERNAL_500"
        );
      }

      const data = (await response.json()) as {
        name: string;
        main: { temp: number; feels_like: number; humidity: number };
        weather: Array<{ main: string; description: string; icon: string }>;
      };

      // Parse response based on OpenWeather API structure
      const weatherData: WeatherData = {
        city: data.name || city,
        temperature: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        condition: data.weather[0]?.main || "Unknown",
        humidity: data.main.humidity,
        description: data.weather[0]?.description || "No description available",
        icon: data.weather[0]?.icon || "01d",
        lastUpdated: new Date().toISOString()
      };

      // Cache the result
      try {
        await redis.set(
          cacheKey,
          JSON.stringify(weatherData),
          "EX",
          WEATHER_CACHE_TTL_SECONDS
        );
      } catch (error) {
        logger.warn("Failed to cache weather data", {
          city,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        // Continue without caching
      }

      logger.info("Weather data fetched from API", { city });

      return weatherData;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown weather API error";
      logger.error("Weather API fetch failed", { city, error: message });

      throw new AppError("Failed to fetch weather data", 500, "INTERNAL_500");
    }
  }

  /**
   * Get weather for multiple cities
   */
  public async getWeatherForCities(cities: string[]): Promise<Record<string, WeatherData>> {
    const results: Record<string, WeatherData> = {};
    const errors: Record<string, string> = {};

    // Fetch in parallel but don't fail if one city fails
    const promises = cities.map(async (city) => {
      try {
        results[city] = await this.getWeather(city);
      } catch (error) {
        errors[city] = error instanceof Error ? error.message : "Unknown error";
      }
    });

    await Promise.all(promises);

    if (Object.keys(errors).length > 0) {
      logger.warn("Weather fetch failed for some cities", errors);
    }

    return results;
  }
}

const weatherService = new WeatherService();

export default weatherService;
