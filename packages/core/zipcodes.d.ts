declare module 'zipcodes' {
  const data: {
    lookupByCoords(
      lat: number,
      lng: number,
    ):
      | {
          zip: string;
          city: string;
          state: string;
          country: string;
          latitude: number;
          longitude: number;
        }
      | undefined;
  };
  export default data;
}
