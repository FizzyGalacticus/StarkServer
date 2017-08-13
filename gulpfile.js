var gulp    = require('gulp'),
	plumber = require('gulp-plumber'),
	babel   = require('gulp-babel'),
	concat  = require('gulp-concat'),
	uglify  = require('gulp-uglify');

gulp.task('build', function() {
	gulp.src(['src/**/*.js'])
	.pipe(plumber())
	.pipe(concat('StarkServer.js'))
	.pipe(babel({
		presets: [
			'es2015',
			'es2016',
			'es2017'
		]
	}))
	.pipe(gulp.dest('./'));

	gulp.src(['./StarkServer.js'])
	.pipe(plumber())
	.pipe(concat('StarkServer.min.js'))
	.pipe(uglify())
	.pipe(gulp.dest('./'));
});

gulp.task('watch', function() {
	gulp.watch('src/**/*.js', ['build']);
});

gulp.task('default', ['build', 'watch']);