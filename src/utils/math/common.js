
const { PI } = Math;
export const EPSILON = 1e-5;
export const degree2radian = deg => deg * PI / 180;
export const radian2degree = rad => rad * 180 / PI;
export const squaredEuclideanDis = (point1, point2) => point1.reduce((sum, x, i) => sum + (x - point2[i]) ** 2, 0);
export const euclideanDis = (point1, point2) => Math.sqrt(squaredEuclideanDis(point1, point2));
export const manhattanDis = (point1, point2) => point1.reduce((sum, x, i) => sum + Math.abs(x - point2[i]), 0);
export const chebyshevDis = (point1, point2) => point1.reduce((max, x, i) => Math.max(max, Math.abs(x - point2[i])), 0);
export const minkowskiDis = (point1, point2, p) => (point1.reduce((sum, x, i) => sum + Math.abs(x - point2[i]) ** p, 0)) ** (1 / p);
